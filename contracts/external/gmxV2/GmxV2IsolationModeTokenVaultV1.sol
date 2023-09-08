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
import { IGmxRegistryV2 } from "./GmxRegistryV2.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezable.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the 
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is IsolationModeTokenVaultV1WithFreezable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";
    bytes32 private constant _VIRTUAL_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);
    bytes32 private constant _IS_DEPOSIT_SOURCE_WRAPPER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceWrapper")) - 1); // solhint-disable max-line-length 
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable max-line-length 

    // @todo make uppercase
    IWETH public immutable weth;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    constructor(address _weth) {
        weth = IWETH(_weth);
    }

    function initiateWrapping(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) external payable nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        uint256 len = _tradersPath.length;
        (uint256 accountNumber, uint256 executionFee) = abi.decode(_tradersPath[len-1].tradeData, (uint256, uint256));
        Require.that(
            msg.value > 0 && executionFee == msg.value,
            _FILE,
            "Invalid executionFee"
        );
        Require.that(
            _tradersPath[len-1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper,
            _FILE,
            "Invalid traderType"
        );
        Require.that(
            accountNumber == _tradeAccountNumber,
            _FILE,
            "Invalid tradeData"
        );

        weth.deposit{value: msg.value}();
        weth.safeApprove(address(registry().gmxV2WrapperTrader()), msg.value);

        // @audit Will this allow reentrancy in _swapExactInputForOutput. May have to requireNotFrozen on external functions instead of internal
        // @follow-up Can't freeze before this or internal call fails because frozen. Can't freeze after or executeDepositFails because it's not frozen
        // So currently freezing in the wrapper
        _swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function initiateUnwrapping() external payable nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        // @todo
    }

    // @audit Need to check this can't be used to unfreeze the vault with a dummy deposit. I don't think it can
    /**
     * 
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        registry().gmxV2WrapperTrader().cancelDeposit(_key);
        _setIsVaultFrozen(false);
    }

    // @follow-up Should these emit events? I think not but just want to ask
    function setIsDepositSourceWrapper(
        bool _isDepositSourceWrapper
    )
    external
    onlyVaultFactory(msg.sender) {
        _setIsDepositSourceWrapper(_isDepositSourceWrapper);
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
        _setVirtualBalance(virtualBalance() + _amount);

        if (!isShouldSkipTransfer()) {
            if (!isDepositSourceWrapper()) {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
            } else {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(
                    address(registry().gmxV2WrapperTrader()),
                    address(this),
                    _amount
                );
                _setIsDepositSourceWrapper(false);
            }
            _compareVirtualToRealBalance();
        } else {
            Require.that(
                isVaultFrozen(),
                _FILE,
                "Vault should be frozen" // @follow-up Revisit this message
            );
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
        _setVirtualBalance(virtualBalance() - _amount);

        if (!isShouldSkipTransfer()) {
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
            _compareVirtualToRealBalance();
        } else {
            Require.that(
                isVaultFrozen(),
                _FILE,
                "Vault should be frozen" // @follow-up Revisit this message
            );
            _setShouldSkipTransfer(false);
        }
    }

    function virtualBalance() public view returns (uint256) {
        return _getUint256(_VIRTUAL_BALANCE_SLOT);
    }

    function isDepositSourceWrapper() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_WRAPPER_SLOT) == 1;
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

    function _setVirtualBalance(uint256 _bal) internal {
        _setUint256(_VIRTUAL_BALANCE_SLOT, _bal);
    }

    function _setIsDepositSourceWrapper(bool _sourceIsWrapper) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_WRAPPER_SLOT, _sourceIsWrapper ? 1 : 0);
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) internal {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function _compareVirtualToRealBalance() internal view {
        Require.that(
            virtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)),
            _FILE,
            "Virtual vs real balance mismatch"
        );
    }
}