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
import { BaseLiquidatorProxy } from "./BaseLiquidatorProxy.sol";
import { GenericTraderProxyBase } from "./GenericTraderProxyBase.sol";
import { GenericTraderProxyV2Lib } from "./GenericTraderProxyV2Lib.sol";
import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";
import { ReentrancyGuardUpgradeable } from "../helpers/ReentrancyGuardUpgradeable.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { ILiquidatorProxyV6 } from "./interfaces/ILiquidatorProxyV6.sol";
import { LiquidatorProxyLib } from "./LiquidatorProxyLib.sol";


/**
 * @title   LiquidatorProxyV6
 * @author  Dolomite
 *
 * Contract for liquidating accounts in DolomiteMargin using generic traders. This contract should presumably work with
 * any liquidation strategy due to its generic implementation. As such, tremendous care should be taken to ensure that
 * the `traders` array passed to the `liquidate` function is correct and will not result in any unexpected behavior
 * for special assets like IsolationMode tokens.
 */
contract LiquidatorProxyV6 is
    HasLiquidatorRegistry,
    BaseLiquidatorProxy,
    GenericTraderProxyBase,
    ReentrancyGuardUpgradeable,
    Initializable,
    ILiquidatorProxyV6
{
    using DecimalLib for uint256;

    // ============ Constants ============

    bytes32 private constant _FILE = "LiquidatorProxyV6";
    uint256 private constant LIQUID_ACCOUNT_ID = 2;
    uint256 private constant DOLOMITE_RAKE_ACCOUNT_ID = 3;
    uint256 private constant _ONE = 1 ether;

    // ============ State Variables ============

    IDolomiteStructs.Decimal public dolomiteRake;

    // ============ Constructor ============

    constructor (
        uint256 _chainId,
        address _expiry,
        address _dolomiteMargin,
        address _dolomiteRegistry,
        address _liquidatorAssetRegistry,
        address _dolomiteAccountRiskOverride
    )
    BaseLiquidatorProxy(
        _dolomiteAccountRiskOverride,
        _liquidatorAssetRegistry,
        _dolomiteMargin,
        _expiry,
        _chainId
    )
    GenericTraderProxyBase(_dolomiteRegistry)
    {}

    // ============ External Functions ============

    function initialize() external initializer {
        __ReentrancyGuardUpgradeable__init();
    }

    function liquidateViaProxyWithStrictInputMarket(
        LiquidateParams memory _liquidateParams
    )
    public
    nonReentrant
    onlyDolomiteMarginGlobalOperator(msg.sender) {
        _validateMarketIdPath(_liquidateParams.marketIdsPath);
        _validateAssetForLiquidation(
            _liquidateParams.marketIdsPath[0],
            /* _liquidator */ msg.sender,
            /* _strict */ true
        );
        _validateAssetForLiquidation(
            _liquidateParams.marketIdsPath[_liquidateParams.marketIdsPath.length - 1],
            /* _liquidator */ msg.sender,
            /* _strict */ false
        );
        _liquidate(_liquidateParams);
    }

    function liquidate(
        LiquidateParams memory _liquidateParams
    ) public nonReentrant {
        _validateMarketIdPath(_liquidateParams.marketIdsPath);
        _validateAssetForLiquidation(_liquidateParams.marketIdsPath[0]);
        _validateAssetForLiquidation(_liquidateParams.marketIdsPath[_liquidateParams.marketIdsPath.length - 1]);
        _liquidate(_liquidateParams);
    }

    function ownerSetDolomiteRake(
        IDolomiteStructs.Decimal memory _dolomiteRake
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_dolomiteRake.value < _ONE) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteRake.value < _ONE,
            _FILE,
            "Invalid dolomite rake"
        );
        dolomiteRake = _dolomiteRake;
        emit DolomiteRakeSet(_dolomiteRake);
    }

    function ownerSetPartialLiquidationThreshold(uint256 _partialLiquidationThreshold) external onlyDolomiteMarginOwner(msg.sender) {
        if (_partialLiquidationThreshold < _ONE) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _partialLiquidationThreshold < _ONE,
            _FILE,
            "Invalid partial threshold"
        );
        partialLiquidationThreshold = _partialLiquidationThreshold;
        emit PartialLiquidationThresholdSet(_partialLiquidationThreshold);
    }

    // ============ Internal Functions ============

    function _liquidate(
        LiquidateParams memory _liquidateParams
    ) internal {
        GenericTraderProxyCache memory genericCache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN(),
            eventEmitterRegistry: IEventEmitterRegistry(address(0)),
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            feeTransferAccountIndex: 0,
            // traders go right after the liquid account ("other account")
            traderAccountStartIndex: DOLOMITE_RAKE_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: TypesLib.zeroWei()
        });
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

        // Put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.solidAccount = _liquidateParams.solidAccount;
        constants.liquidAccount = _liquidateParams.liquidAccount;
        constants.expirationTimestamp = _liquidateParams.expirationTimestamp;
        constants.heldMarket = _liquidateParams.marketIdsPath[0];
        constants.owedMarket = _liquidateParams.marketIdsPath[_liquidateParams.marketIdsPath.length - 1];

        LiquidatorProxyLib.checkConstants(DOLOMITE_MARGIN(), constants);

        constants.liquidMarkets = DOLOMITE_MARGIN().getAccountMarketsWithBalances(constants.liquidAccount);
        constants.markets = LiquidatorProxyLib.getMarketInfos(
            DOLOMITE_MARGIN(),
            DOLOMITE_MARGIN().getAccountMarketsWithBalances(constants.solidAccount),
            constants.liquidMarkets
        );
        LiquidatorProxyCache memory liquidatorCache = _initializeCache(constants);

        // validate the msg.sender and that the expiration matches (if being used)
        LiquidatorProxyLib.checkBasicRequirements(DOLOMITE_MARGIN(), EXPIRY, constants);

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(liquidatorCache, constants);

        (_liquidateParams.inputAmountWei, _liquidateParams.minOutputAmountWei) =
        _calculateAndSetActualLiquidationAmount(
            _liquidateParams.inputAmountWei,
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
        accounts[DOLOMITE_RAKE_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: DOLOMITE_REGISTRY.feeAgent(),
            number: DEFAULT_ACCOUNT_NUMBER
        });
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
        uint256 dolomiteRakeAmount = _appendDolomiteRakeTransferAction(
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
            _liquidateParams.inputAmountWei == liquidatorCache.solidHeldUpdateWithReward
                ? _liquidateParams.inputAmountWei - dolomiteRakeAmount
                : _liquidateParams.inputAmountWei,
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

    function _appendWithdrawRewardAction(
        IDolomiteStructs.ActionArgs[] memory _actions,
        LiquidatorProxyConstants memory _constants,
        GenericTraderProxyCache memory _genericCache
    )
        internal
        view
    {
        IDolomiteStructs.Wei memory targetAmountWei = DOLOMITE_MARGIN().getAccountWei(
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
            if (_inputAmountWei == type(uint256).max) { /* FOR COVERAGE TESTING */ }
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
        view
    {
        // solidAccountId is always at index 0, liquidAccountId is always at index 1
        if (_constants.expirationTimestamp != 0) {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeExpiryLiquidateAction(
                TRADE_ACCOUNT_ID,
                LIQUID_ACCOUNT_ID,
                _constants.owedMarket,
                _constants.heldMarket,
                address(EXPIRY),
                uint32(_constants.expirationTimestamp),
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

    function _appendDolomiteRakeTransferAction(

        IDolomiteStructs.ActionArgs[] memory _actions,
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _liquidatorCache,
        GenericTraderProxyCache memory _genericCache
    )
        internal
        view
        returns (uint256)
    {
        uint256 dolomiteRakeAmount;
        if (_constants.expirationTimestamp > 0) {
            dolomiteRakeAmount = 0;
        } else {
            uint256 heldWeiWithoutReward = _liquidatorCache.owedWeiToLiquidate * _liquidatorCache.owedPrice / _liquidatorCache.heldPrice; // solhint-disable-line max-line-length
            dolomiteRakeAmount = (_liquidatorCache.solidHeldUpdateWithReward - heldWeiWithoutReward).mul(dolomiteRake); // solhint-disable-line max-line-length
        }

        _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeTransferAction(
            TRADE_ACCOUNT_ID,
            DOLOMITE_RAKE_ACCOUNT_ID,
            _constants.heldMarket,
            IDolomiteStructs.AssetDenomination.Wei,
            dolomiteRakeAmount
        );

        return dolomiteRakeAmount;
    }

    function _otherAccountId() internal pure override returns (uint256) {
        return LIQUID_ACCOUNT_ID;
    }

    function _getLiquidationActionsLength(bool _withdrawAllReward) internal pure returns (uint256) {
        // 1 for liquidate action, 1 for dolomite rake transfer, 1 for withdrawal reward
        return _withdrawAllReward ? 3 : 2;
    }
}
