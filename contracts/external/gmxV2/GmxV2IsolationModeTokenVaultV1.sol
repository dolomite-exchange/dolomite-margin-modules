// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IGmxV2Registry } from "./GmxV2Registry.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezable.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is
    IGmxV2IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using Address for address payable;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(address _weth) IsolationModeTokenVaultV1WithFreezable(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    // @audit Need to check this can't be used to unfreeze the vault with a dummy deposit. I don't think it can
    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper =
                                registry().getWrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
        _validateVaultOwnerForStruct(unwrapper.getWithdrawalInfo(_key).vault);
        unwrapper.initiateCancelWithdrawal(_key);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(virtualBalance() + _amount);

        if (!shouldSkipTransfer()) {
            if (!isDepositSourceWrapper()) {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
            } else {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(
                    address(registry().getWrapperByToken(IIsolationModeVaultFactory(VAULT_FACTORY()))),
                    address(this),
                    _amount
                );
                _setIsVaultDepositSourceWrapper(/* _isDepositSourceWrapper = */ false);
            }
            _requireVirtualBalanceWithPendingMatchesRealBalance();
        } else {
            Require.that(
                isVaultFrozen(),
                _FILE,
                "Vault should be frozen"
            );
            _setShouldVaultSkipTransfer(/* _shouldSkipTransfer = */ false);
        }
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(virtualBalance() - _amount);

        if (!shouldSkipTransfer()) {
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
            _requireVirtualBalanceWithPendingMatchesRealBalance();
        } else {
            Require.that(
                isVaultFrozen(),
                _FILE,
                "Vault should be frozen"
            );
            _setShouldVaultSkipTransfer(false);
        }
    }

    function isExternalRedemptionPaused()
        public
        override
        view
        returns (bool)
    {
        return GmxV2Library.isExternalRedemptionPaused(
            registry(),
            DOLOMITE_MARGIN(),
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY())
        );
    }

    function registry() public view returns (IGmxV2Registry) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxV2Registry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        GmxV2Library.validateExecutionFee(/* _vault = */ this, _toAccountNumber);
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(_toAccountNumber, msg.value);
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        Require.that(
            getExecutionFeeForAccountNumber(_borrowAccountNumber) != 0,
            _FILE,
            "Missing execution fee"
        );
        super._transferIntoPositionWithUnderlyingToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        );
    }

    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    virtual
    override {
        uint256 len = _tradersPath.length;
        if (_tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            GmxV2Library.depositAndApproveWethForWrapping(this);
            _tradersPath[len - 1].tradeData = abi.encode(_tradeAccountNumber, abi.encode(msg.value));
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }

        if (_tradersPath[0].traderType == IGenericTraderBase.TraderType.IsolationModeUnwrapper || isVaultFrozen()) {
            // Only a trusted converter can initiate unwraps (via the callback) OR execute swaps if the vault is frozen
            _requireOnlyConverter(msg.sender);
        }

        // Ignore the freezable implementation and call the pausable one directly
        IsolationModeTokenVaultV1WithPausable._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        super._transferFromPositionWithUnderlyingToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _amountWei
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal
    override {
        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    internal
    override {
        super._closeBorrowPositionWithUnderlyingVaultToken(
            _borrowAccountNumber,
            _toAccountNumber
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    internal
    override {
        super._closeBorrowPositionWithOtherTokens(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation
    ) internal override {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY());
        Require.that(
            registry().getUnwrapperByToken(factory).isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        GmxV2Library.validateAndExecuteInitiateUnwrapping(
            factory,
            /* _vault = */ address(this),
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            ethExecutionFee,
            _isLiquidation
        );
    }

    function _requireVirtualBalanceWithPendingMatchesRealBalance() internal view {
        address vault = address(this);
        uint256 pendingDeposit = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).getPendingAmountByVault(
            vault,
            IFreezableIsolationModeVaultFactory.FreezeType.Deposit
        );
        uint256 pendingWithdrawal = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).getPendingAmountByVault(
            vault,
            IFreezableIsolationModeVaultFactory.FreezeType.Withdrawal
        );
        Require.that(
            virtualBalance() - pendingDeposit + pendingWithdrawal == IERC20(UNDERLYING_TOKEN()).balanceOf(vault),
            _FILE,
            "Virtual vs real balance mismatch"
        );
    }

    function _validateVaultOwnerForStruct(address _vault) internal view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
        );
    }

    function _checkMsgValue() internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Don't do any validation here. We check the msg.value conditionally in the `swapExactInputForOutput`
        // implementation
    }

    function _refundExecutionFeeIfNecessary(uint256 _borrowAccountNumber) private {
        IDolomiteStructs.AccountInfo memory borrowAccountInfo = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _borrowAccountNumber
        });
        if (DOLOMITE_MARGIN().getAccountNumberOfMarketsWithBalances(borrowAccountInfo) == 0) {
            // There's no assets left in the position. Issue a refund for the execution fee
            uint256 executionFee = getExecutionFeeForAccountNumber(_borrowAccountNumber);
            _setExecutionFeeForAccountNumber(_borrowAccountNumber, /* _executionFee = */ 0);
            // @audit: check for any reentrancy issues! No user-level functions on the vault should be reentered
            payable(OWNER()).sendValue(executionFee);
        }
    }
}
