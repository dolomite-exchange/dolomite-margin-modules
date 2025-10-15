// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

// solhint-disable max-line-length
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IIsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGLPRedemptionOperator } from "./interfaces/IGLPRedemptionOperator.sol";
// solhint-enable max-line-length


/**
 * @title   GLPRedemptionOperator
 * @author  Dolomite
 *
 * @notice  Global operator that allows handler to redeem GLP and claim USDC redemption
 */
contract GLPRedemptionOperator is OnlyDolomiteMargin, IGLPRedemptionOperator {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GLPRedemptionOperator";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    uint256 private constant _USDC_FUND_ACCOUNT_ID = 0;
    uint256 private constant _VAULT_ACCOUNT_ID = 1;
    uint256 private constant _VAULT_OWNER_ACCOUNT_ID = 2;

    address public immutable HANDLER;
    address public immutable USDC_FUND;

    uint256 public immutable USDC_MARKET_ID;
    IIsolationModeVaultFactory public immutable FACTORY;
    IIsolationModeUnwrapperTraderV2 public immutable UNWRAPPER_TRADER;

    mapping(address => mapping(uint256 => uint256)) public usdcRedemptionAmount;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyHandler(address _sender) {
        Require.that(
            _sender == HANDLER,
            _FILE,
            "Only handler can call"
        );
        _;
    }

    // ==================================================================
    // ======================== Constructor =============================
    // ==================================================================

    constructor(
        address _handler,
        address _usdcFund,
        uint256 _usdcMarketId,
        address _factory, // only glp or plvGlp
        address _unwrapperTrader, // only glp or plvGlp
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        HANDLER = _handler;
        USDC_FUND = _usdcFund;

        USDC_MARKET_ID = _usdcMarketId;
        FACTORY = IIsolationModeVaultFactory(_factory);
        UNWRAPPER_TRADER = IIsolationModeUnwrapperTraderV2(_unwrapperTrader);
    }

    // ==================================================================
    // ====================== Restricted Functions ======================
    // ==================================================================

    /// @inheritdoc IGLPRedemptionOperator
    function handlerSetRedemptionAmounts(
        address _vault,
        uint256[] memory _accountNumbers,
        uint256[] memory _usdcRedemptionAmounts
    ) external onlyHandler(msg.sender) {
        Require.that(
            _accountNumbers.length == _usdcRedemptionAmounts.length,
            _FILE,
            "Invalid input lengths"
        );

        for (uint256 i; i < _accountNumbers.length; ++i) {
            usdcRedemptionAmount[_vault][_accountNumbers[i]] = _usdcRedemptionAmounts[i];
        }
        emit UsdcRedemptionAmountSet(_vault, _accountNumbers, _usdcRedemptionAmounts);
    }

    /// @inheritdoc IGLPRedemptionOperator
    function handlerExecuteVault(
        address _vault,
        RedemptionParams[] memory _redemptionParams
    ) external onlyHandler(msg.sender) {
        for (uint256 i; i < _redemptionParams.length; ++i) {
            _executeRedemption(_vault, _redemptionParams[i]);
        }
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _executeRedemption(
        address _vault,
        RedemptionParams memory _redemptionParams
    ) internal {
        address vaultOwner = FACTORY.getAccountByVault(_vault);
        Require.that(
            vaultOwner != address(0),
            _FILE,
            "Invalid vault"
        );

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](3);
        accounts[_USDC_FUND_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: USDC_FUND,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        accounts[_VAULT_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _vault,
            number: _redemptionParams.accountNumber
        });
        accounts[_VAULT_OWNER_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: vaultOwner,
            number: _DEFAULT_ACCOUNT_NUMBER
        });


        uint256 bal = DOLOMITE_MARGIN().getAccountWei(accounts[_VAULT_ACCOUNT_ID], FACTORY.marketId()).value;
        uint256 usdcAmount = usdcRedemptionAmount[_vault][_redemptionParams.accountNumber];
        delete usdcRedemptionAmount[_vault][_redemptionParams.accountNumber];
        
        // @dev optimistically set the max length
        uint256 actionsLength;
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](5);

        if (bal > 0) {
            _appendUnwrapActions(
                actions,
                _VAULT_ACCOUNT_ID,
                _vault,
                _redemptionParams.accountNumber,
                _redemptionParams.outputMarketId,
                _redemptionParams.minOutputAmountWei
            );
            actionsLength += 2;
        }

        actions[actionsLength++] = AccountActionLib.encodeTransferAction(
            _USDC_FUND_ACCOUNT_ID,
            _VAULT_ACCOUNT_ID,
            USDC_MARKET_ID,
            IDolomiteStructs.AssetDenomination.Wei,
            usdcAmount
        );

        // @dev if default account, transfer USDC and output token to vault owner
        if (_redemptionParams.accountNumber == 0) {
            actions[actionsLength++] = AccountActionLib.encodeTransferAction(
                _VAULT_ACCOUNT_ID,
                _VAULT_OWNER_ACCOUNT_ID,
                USDC_MARKET_ID,
                IDolomiteStructs.AssetDenomination.Wei,
                type(uint256).max
            );
            actions[actionsLength++] = AccountActionLib.encodeTransferAction(
                _VAULT_ACCOUNT_ID,
                _VAULT_OWNER_ACCOUNT_ID,
                _redemptionParams.outputMarketId,
                IDolomiteStructs.AssetDenomination.Wei,
                type(uint256).max
            );
        }
        
        // overwrite the actual actions length
        assembly {
            mstore(actions, actionsLength)
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    /**
     * Appends the unwrap actions for the operation
     * 
     * @dev Unwrapping GLP is always 2 actions
     * 
     * @param  _actions             The actions to append to
     * @param  _vault               The address of the GLP vault
     * @param  _accountNumber       The account number of the GLP vault
     * @param  _outputMarketId      The market id of the output token
     * @param  _minOutputAmountWei  The minimum amount of output token to receive
     */
    function _appendUnwrapActions(
        IDolomiteStructs.ActionArgs[] memory _actions,
        uint256 _vaultAccountId,
        address _vault,
        uint256 _accountNumber,
        uint256 _outputMarketId,
        uint256 _minOutputAmountWei
    ) internal view {
        IDolomiteStructs.ActionArgs[] memory unwrapActions = UNWRAPPER_TRADER.createActionsForUnwrapping(
            IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParams({
                primaryAccountId: _vaultAccountId,
                otherAccountId: _vaultAccountId,
                primaryAccountOwner: _vault,
                primaryAccountNumber: _accountNumber,
                otherAccountOwner: _vault,
                otherAccountNumber: _accountNumber,
                outputMarket: _outputMarketId,
                inputMarket: FACTORY.marketId(),
                minOutputAmount: _minOutputAmountWei,
                inputAmount: DOLOMITE_MARGIN().getAccountWei(
                    IDolomiteStructs.AccountInfo({
                        owner: _vault,
                        number: _accountNumber
                    }),
                    FACTORY.marketId()
                ).value,
                orderData: abi.encode(_minOutputAmountWei)
            })
        );

        for (uint256 i; i < unwrapActions.length; ++i) {
            _actions[i] = unwrapActions[i];
        }
    }
}
