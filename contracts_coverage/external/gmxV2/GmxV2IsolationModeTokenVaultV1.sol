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
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxRegistryV2 } from "./GmxRegistryV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";

import { Deposit } from "../interfaces/gmx/GmxDeposit.sol";
import { EventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { Withdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxDepositCallbackReceiver } from "../interfaces/gmx/IGmxDepositCallbackReceiver.sol";
import { IGmxWithdrawalCallbackReceiver } from "../interfaces/gmx/IGmxWithdrawalCallbackReceiver.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is IsolationModeTokenVaultV1, ProxyContractHelpers {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";
    bytes32 private constant _VIRTUAL_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);
    bytes32 private constant _VAULT_FROZEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFrozen")) - 1);
    bytes32 private constant _SOURCE_IS_WRAPPER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.sourceIsWrapper")) - 1);
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable max-line-length

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireNotFrozen() {
        if (!isVaultFrozen()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isVaultFrozen(),
            _FILE,
            "Vault is frozen"
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function initiateWrapping(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) external payable nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        if (msg.value > 0) {
            address payable wrapper = payable(address(registry().gmxV2WrapperTrader()));
            (bool success, ) = wrapper.call{value: msg.value}("");
            require(success, "Unable to send funds to wrapper");
        }

        _swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
        // @audit Will this allow reentrancy in _swapExactInputForOutput. May have to requireNotFrozen on external functions instead of internal
        _setVaultFrozen(true);
    }

    function initiateUnwrapping() external payable nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        // @todo
    }

    // @audit Need to check this can't be used to unfreeze the vault with a dummy deposit. I don't think it can
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        registry().gmxV2WrapperTrader().cancelDeposit(_key);
        _setVaultFrozen(false);
    }

    function setVaultFrozen(
        bool _vaultFrozen
    )
    external
    onlyVaultFactory(msg.sender) {
        _setVaultFrozen(_vaultFrozen);
    }

    // @follow-up Should these emit events? I think not but just want to ask
    function setSourceIsWrapper(
        bool _sourceIsWrapper
    )
    external
    onlyVaultFactory(msg.sender) {
        _setSourceIsWrapper(_sourceIsWrapper);
    }

    function setShouldSkipTransfer(
        bool _shouldSkipTransfer
    )
    external
    onlyVaultFactory(msg.sender) {
        _setShouldSkipTransfer(_shouldSkipTransfer);
    }

    // @audit Does this need to be requireNotFrozen? I don't think so but want to confirm
    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(getVirtualBalance() + _amount);

        if (!isShouldSkipTransfer()) {
            if (!isSourceIsWrapper()) {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
            }
            else {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(
                    address(registry().gmxV2WrapperTrader()),
                    address(this),
                    _amount
                );
                _setSourceIsWrapper(false);
            }
            _compareVirtualToRealBalance();
        } else {
            // @todo confirm the vault is frozen
            _setShouldSkipTransfer(false);
        }
    }

    // @audit Does this need to be requireNotFrozen? I don't think so but want to confirm
    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(getVirtualBalance() - _amount);

        if (!isShouldSkipTransfer()) {
                IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
                _compareVirtualToRealBalance();
        }
        else {
            _setShouldSkipTransfer(false);
        }
    }

    function getVirtualBalance() public view returns (uint256) {
        return _getUint256(_VIRTUAL_BALANCE_SLOT);
    }

    function isVaultFrozen() public view returns (bool) {
        return _getUint256(_VAULT_FROZEN_SLOT) == 1;
    }

    function isSourceIsWrapper() public view returns (bool) {
        return _getUint256(_SOURCE_IS_WRAPPER_SLOT) == 1;
    }

    function isShouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function registry() public view returns (IGmxRegistryV2) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistryV2();
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

    // @follow-up If these internal functions need to be used when frozen, we can overwrite external ones instead
    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal override requireNotFrozen() {
        super._depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal override requireNotFrozen() {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal override requireNotFrozen() {
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    internal override requireNotFrozen() {
        super._closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    internal override requireNotFrozen() {
        super._closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    internal override requireNotFrozen() {
        super._transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
    }

    function _transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal override requireNotFrozen() {
        super._transferIntoPositionWithOtherToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal override requireNotFrozen() {
        super._transferFromPositionWithUnderlyingToken(_borrowAccountNumber, _toAccountNumber, _amountWei);
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal override requireNotFrozen() {
        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function _repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal override requireNotFrozen() {
        super._repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
    }

    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) internal override requireNotFrozen() {
        super._addCollateralAndSwapExactInputForOutput(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal override requireNotFrozen() {
        super._swapExactInputForOutputAndRemoveCollateral(
            _toAccountNumber,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal override requireNotFrozen() {
        super._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _setVirtualBalance(uint256 _bal) internal {
        _setUint256(_VIRTUAL_BALANCE_SLOT, _bal);
    }

    function _setVaultFrozen(bool _vaultFrozen) internal {
        _setUint256(_VAULT_FROZEN_SLOT, _vaultFrozen ? 1 : 0);
    }

    function _setSourceIsWrapper(bool _sourceIsWrapper) internal {
        _setUint256(_SOURCE_IS_WRAPPER_SLOT, _sourceIsWrapper ? 1 : 0);
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) internal {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function _compareVirtualToRealBalance() internal view {
        if (getVirtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this))) { /* FOR COVERAGE TESTING */ }
        Require.that(getVirtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)),
            _FILE,
            "Virtual and real balance error"
        );
    }
}
