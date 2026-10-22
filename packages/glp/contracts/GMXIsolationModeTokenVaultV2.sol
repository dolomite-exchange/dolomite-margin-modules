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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeTokenVaultV2 } from "./interfaces/IGMXIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeVaultFactory } from "./interfaces/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";

import "hardhat/console.sol";

/**
 * @title   GMXIsolationModeTokenVaultV2
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GMXIsolationModeTokenVaultV2 is
    IGMXIsolationModeTokenVaultV2,
    IsolationModeTokenVaultV1WithFreezable
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GMXIsolationModeTokenVaultV2";

    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_DEPOSIT_SOURCE_GLP_VAULT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceGLPVault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _RECIPIENT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.recipient")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _TEMP_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.tempBalance")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    modifier onlyHandler(address _handler) {
        Require.that(
            registry().isHandler(_handler),
            _FILE,
            "Invalid handler",
            _handler
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function ownerUnstakeGmx() external onlyHandler(msg.sender) {
        IGLPIsolationModeTokenVaultV2 glpVault = IGLPIsolationModeTokenVaultV2(registry().glpVaultFactory().getVaultByAccount(OWNER()));
        assert(address(glpVault) != address(0));

        if (glpVault.vGmx().balanceOf(address(glpVault)) > 0) {
            glpVault.unvestGmx(false, false);
        }

        uint256 gmxBalOf = IGLPIsolationModeTokenVaultV2(glpVault).gmxBalanceOf();
        if (gmxBalOf > 0) {
            uint256 unstakeAmount = IGLPIsolationModeTokenVaultV2(glpVault).maxGmxUnstakeAmount();
            IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(unstakeAmount);
        }
    }

    function unstakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(_amount);
    }

    function unvestGmx(bool _shouldStakeGmx) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unvestGmx(/* _shouldStakeGmx */ false, /* _addDepositIntoDolomite = */ false);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        return IGLPIsolationModeTokenVaultV2(glpVault).gmxBalanceOf() + super.underlyingBalanceOf();
    }

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function isDepositSourceGLPVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT) == 1;
    }

    function isVaultFrozen()
    public
    view
    override(IIsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithFreezable)
    returns (bool) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        return _getAddress(_RECIPIENT_SLOT) != address(0)
            || registry().gmxRewardsRouter().pendingReceivers(glpVault) != address(0);
    }

    function registry() public view returns (IGmxRegistryV1) {
        return IGMXIsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistry();
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
    // ======================== Internal Functions ======================
    // ==================================================================

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    ) internal override {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei, _isViaRouter);
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    ) internal override {
        super._swapExactInputForOutput(_params);
    }
}
