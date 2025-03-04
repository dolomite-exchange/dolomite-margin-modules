// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { GenericTraderProxyBase } from "./GenericTraderProxyBase.sol";
import { GenericTraderProxyV2Lib } from "./GenericTraderProxyV2Lib.sol";
import { LiquidatorProxyBase } from "./LiquidatorProxyBase.sol";
import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { ILiquidatorProxyV5 } from "./interfaces/ILiquidatorProxyV5.sol";


/**
 * @title   LiquidatorProxyV5
 * @author  Dolomite
 *
 * Contract for liquidating accounts in DolomiteMargin using generic traders. This contract should presumably work with
 * any liquidation strategy due to its generic implementation. As such, tremendous care should be taken to ensure that
 * the `traders` array passed to the `liquidate` function is correct and will not result in any unexpected behavior
 * for special assets like IsolationMode tokens.
 */
contract LiquidatorProxyV5 is
    HasLiquidatorRegistry,
    LiquidatorProxyBase,
    GenericTraderProxyBase,
    ReentrancyGuard,
    Initializable,
    ILiquidatorProxyV5
{

    // ============ Constants ============

    bytes32 private constant _FILE = "LiquidatorProxyV5";
    uint256 private constant LIQUID_ACCOUNT_ID = 2;

    // ============ Storage ============

    IExpiry public immutable EXPIRY;
    IDolomiteMargin public immutable DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        uint256 _chainId,
        address _expiryProxy,
        address _dolomiteMargin,
        address _dolomiteRegistry,
        address _liquidatorAssetRegistry
    )
    LiquidatorProxyBase(
        _chainId,
        _liquidatorAssetRegistry
    )
    GenericTraderProxyBase(
        _chainId,
        _dolomiteRegistry
    )
    {
        EXPIRY = IExpiry(_expiryProxy);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ External Functions ============

    function initialize() external initializer {}

    function liquidate(
        LiquidateParams memory _liquidateParams
    )
        public
        nonReentrant
    {
        GenericTraderProxyCache memory genericCache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            eventEmitterRegistry: IEventEmitterRegistry(address(0)),
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            feeTransferAccountIndex: 0,
            // traders go right after the liquid account ("other account")
            traderAccountStartIndex: LIQUID_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: TypesLib.zeroWei()
        });
        _validateMarketIdPath(_liquidateParams.marketIdsPath);
        _validateAmountWeis(_liquidateParams.inputAmountWei, _liquidateParams.minOutputAmountWei);
        GenericTraderProxyV2Lib.validateTraderParams(
            genericCache,
            _liquidateParams.marketIdsPath,
            _liquidateParams.makerAccounts,
            _liquidateParams.tradersPath
        );
        _validateInputAmountAndInputMarketForIsolationMode(
            _liquidateParams.tradersPath[0],
            _liquidateParams.inputAmountWei
        );

        // put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.dolomiteMargin = genericCache.dolomiteMargin;
        constants.solidAccount = _liquidateParams.solidAccount;
        constants.liquidAccount = _liquidateParams.liquidAccount;
        constants.heldMarket = _liquidateParams.marketIdsPath[0];
        constants.owedMarket = _liquidateParams.marketIdsPath[_liquidateParams.marketIdsPath.length - 1];

        _checkConstants(constants, _liquidateParams.expiry);
        _validateAssetForLiquidation(constants.heldMarket);
        _validateAssetForLiquidation(constants.owedMarket);

        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(constants.liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_liquidateParams.solidAccount),
            constants.liquidMarkets
        );
        // If there's no expiry set, don't read EXPIRY (it's not needed)
        constants.expiryProxy = _liquidateParams.expiry != 0 ? EXPIRY: IExpiry(address(0));
        constants.expiry = uint32(_liquidateParams.expiry);

        LiquidatorProxyCache memory liquidatorCache = _initializeCache(constants);

        // validate the msg.sender and that the expiration matches (if being used)
        _checkBasicRequirements(constants);

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(liquidatorCache);

        _liquidateParams.minOutputAmountWei = _calculateAndSetActualLiquidationAmount(
            _liquidateParams.minOutputAmountWei,
            liquidatorCache
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            genericCache,
            _liquidateParams.makerAccounts,
            _liquidateParams.solidAccount.owner,
            _liquidateParams.solidAccount.number,
            _liquidateParams.tradersPath
        );
        // the call to _getAccounts leaves accounts[LIQUID_ACCOUNT_ID] null because it fills in the traders starting at
        // the `traderAccountCursor` index
        accounts[LIQUID_ACCOUNT_ID] = _liquidateParams.liquidAccount;
        _validateZapAccount(genericCache, accounts[ZAP_ACCOUNT_ID], _liquidateParams.marketIdsPath);

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _getLiquidationActionsLength(_liquidateParams.withdrawAllReward) +
            _getActionsLengthForTraderParams(
                genericCache,
                _liquidateParams.tradersPath,
                accounts,
                _liquidateParams.minOutputAmountWei
            )
        );
        _appendLiquidationAction(
            actions,
            constants,
            liquidatorCache,
            genericCache
        );
        _appendTraderActions(
            accounts,
            actions,
            genericCache,
            true,
            _liquidateParams.marketIdsPath,
            _liquidateParams.inputAmountWei,
            _liquidateParams.minOutputAmountWei,
            _liquidateParams.tradersPath
        );

        if (_liquidateParams.withdrawAllReward) {
            _appendWithdrawRewardAction(
                actions,
                constants,
                genericCache
            );
        }
        genericCache.dolomiteMargin.operate(accounts, actions);
    }

    // ============ Internal Functions ============

    function _appendWithdrawRewardAction(
        IDolomiteStructs.ActionArgs[] memory _actions,
        LiquidatorProxyConstants memory _constants,
        GenericTraderProxyCache memory _genericCache
    )
        internal
        view
    {
        IDolomiteStructs.Wei memory targetAmountWei = _constants.dolomiteMargin.getAccountWei(
            _constants.solidAccount,
            _constants.owedMarket
        );
        _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeWithdrawalAction(
            TRADE_ACCOUNT_ID,
            _constants.owedMarket,
            IDolomiteStructs.AssetAmount({
                sign: targetAmountWei.sign,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Target,
                value: targetAmountWei.value
            }),
            _constants.solidAccount.owner
        );
    }

    function _validateInputAmountAndInputMarketForIsolationMode(
        TraderParam memory _param,
        uint256 _inputAmountWei
    ) internal pure {
        if (_isUnwrapperTraderType(_param.traderType) || _isWrapperTraderType(_param.traderType)) {
            // For liquidations, the asset amount must match the amount of collateral transferred from liquid account
            // to solid account. This is done via always selling the max amount of held collateral.
            Require.that(
                _inputAmountWei == type(uint256).max,
                _FILE,
                "Invalid amount for IsolationMode"
            );
        }
    }

    function _appendLiquidationAction(
        IDolomiteStructs.ActionArgs[] memory _actions,
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _liquidatorCache,
        GenericTraderProxyCache memory _genericCache
    )
        internal
        pure
    {
        // solidAccountId is always at index 0, liquidAccountId is always at index 1
        if (_constants.expiry != 0) {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeExpiryLiquidateAction(
                TRADE_ACCOUNT_ID,
                LIQUID_ACCOUNT_ID,
                _constants.owedMarket,
                _constants.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry, // @follow-up Adjusted two things here
                _liquidatorCache.flipMarketsForExpiration
            );
        } else {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeLiquidateAction(
                TRADE_ACCOUNT_ID,
                LIQUID_ACCOUNT_ID,
                _constants.owedMarket,
                _constants.heldMarket,
                _liquidatorCache.owedWeiToLiquidate
            );
        }
    }

    function _otherAccountId() internal pure override returns (uint256) {
        return LIQUID_ACCOUNT_ID;
    }

    function _getLiquidationActionsLength(bool _withdrawAllReward) internal pure returns (uint256) {
        return _withdrawAllReward ? 2 : 1;
    }
}
