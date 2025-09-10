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
    uint256 private constant _VAULT_OWNER_DEFAULT_ACCOUNT_ID = 2;

    address public immutable HANDLER;
    address public immutable USDC_FUND;

    uint256 public immutable USDC_MARKET_ID;
    IIsolationModeVaultFactory public immutable GLP_FACTORY;
    IIsolationModeUnwrapperTraderV2 public immutable GLP_UNWRAPPER_TRADER;

    mapping(address => mapping(uint256 => uint256)) public usdcRedemptionAmount;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyHandler(address _sender) {
        if (_sender == HANDLER) { /* FOR COVERAGE TESTING */ }
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
        address _glpFactory,
        address _glpUnwrapperTrader,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        HANDLER = _handler;
        USDC_FUND = _usdcFund;

        USDC_MARKET_ID = _usdcMarketId;
        GLP_FACTORY = IIsolationModeVaultFactory(_glpFactory);
        GLP_UNWRAPPER_TRADER = IIsolationModeUnwrapperTraderV2(_glpUnwrapperTrader);
    }

    // ==================================================================
    // ====================== Restricted Functions ======================
    // ==================================================================

    /// @inheritdoc IGLPRedemptionOperator
    function handlerSetUsdcRedemptionAmounts(
        address[] memory _vaults,
        uint256[] memory _accountNumbers,
        uint256[] memory _amounts
    ) external onlyHandler(msg.sender) {
        if (_vaults.length == _accountNumbers.length && _vaults.length == _amounts.length) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _vaults.length == _accountNumbers.length && _vaults.length == _amounts.length,
            _FILE,
            "Invalid input lengths"
        );

        for (uint256 i = 0; i < _vaults.length; ++i) {
            usdcRedemptionAmount[_vaults[i]][_accountNumbers[i]] = _amounts[i];
            emit UsdcRedemptionAmountSet(_vaults[i], _accountNumbers[i], _amounts[i]);
        }
    }

    /// @inheritdoc IGLPRedemptionOperator
    function handlerRedeemGLP(
        address _vault,
        uint256 _accountNumber,
        uint256 _outputMarketId,
        uint256 _minOutputAmountWei
    ) external onlyHandler(msg.sender) {
        address vaultOwner = GLP_FACTORY.getAccountByVault(_vault);
        if (vaultOwner != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            vaultOwner != address(0),
            _FILE,
            "Invalid GLP vault"
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(_vault, vaultOwner, _accountNumber);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](_accountNumber == 0 ? 4 : 3);

        _appendUnwrapActions(actions, _vault, _accountNumber, _outputMarketId, _minOutputAmountWei);
        actions[2] = AccountActionLib.encodeTransferAction(
            /* fromAccountId = */ _USDC_FUND_ACCOUNT_ID,
            /* toAccountId = */ _accountNumber == 0 ? _VAULT_OWNER_DEFAULT_ACCOUNT_ID : _VAULT_ACCOUNT_ID,
            USDC_MARKET_ID,
            IDolomiteStructs.AssetDenomination.Wei,
            usdcRedemptionAmount[_vault][_accountNumber]
        );

        // If in the vault default account, transfer all of the output token to the vault owner's default account
        if (_accountNumber == 0) {
            actions[3] = AccountActionLib.encodeTransferAction(
                /* fromAccountId = */ _VAULT_ACCOUNT_ID,
                /* toAccountId = */ _VAULT_OWNER_DEFAULT_ACCOUNT_ID,
                _outputMarketId,
                IDolomiteStructs.AssetDenomination.Wei,
                type(uint256).max
            );
        }

        usdcRedemptionAmount[_vault][_accountNumber] = 0;
        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    /**
     * Gets the accounts for the operation
     *
     * @dev If account number is 0, the vault owner's default account is added
     *
     * @param  _vault            The address of the GLP vault
     * @param  _vaultOwner       The owner of the GLP vault
     * @param  _accountNumber    The account number of the GLP vault
     */
    function _getAccounts(
        address _vault,
        address _vaultOwner,
        uint256 _accountNumber
    ) internal view returns (IDolomiteStructs.AccountInfo[] memory) {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](
            _accountNumber == 0 ? 3 : 2
        );

        accounts[_USDC_FUND_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: USDC_FUND,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        accounts[_VAULT_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _vault,
            number: _accountNumber
        });

        if (_accountNumber == 0) {
            accounts[_VAULT_OWNER_DEFAULT_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
                owner: _vaultOwner,
                number: _DEFAULT_ACCOUNT_NUMBER
            });
        }

        return accounts;
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
        address _vault,
        uint256 _accountNumber,
        uint256 _outputMarketId,
        uint256 _minOutputAmountWei
    ) internal view {
        IDolomiteStructs.ActionArgs[] memory unwrapActions = GLP_UNWRAPPER_TRADER.createActionsForUnwrapping(
            IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParams({
                primaryAccountId: _VAULT_ACCOUNT_ID,
                otherAccountId: _VAULT_ACCOUNT_ID,
                primaryAccountOwner: _vault,
                primaryAccountNumber: _accountNumber,
                otherAccountOwner: _vault,
                otherAccountNumber: _accountNumber,
                outputMarket: _outputMarketId,
                inputMarket: GLP_FACTORY.marketId(),
                minOutputAmount: _minOutputAmountWei,
                inputAmount: DOLOMITE_MARGIN().getAccountWei(
                    IDolomiteStructs.AccountInfo({
                        owner: _vault,
                        number: _accountNumber
                    }),
                    GLP_FACTORY.marketId()
                ).value,
                orderData: abi.encode(_minOutputAmountWei)
            })
        );

        for (uint256 i; i < unwrapActions.length; ++i) {
            _actions[i] = unwrapActions[i];
        }
    }
}
