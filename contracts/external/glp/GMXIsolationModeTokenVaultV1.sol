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
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGLPIsolationModeTokenVaultV2 } from "../interfaces/gmx/IGLPIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeTokenVaultV1 } from "../interfaces/gmx/IGMXIsolationModeTokenVaultV1.sol";
import { IGMXIsolationModeVaultFactory } from "../interfaces/gmx/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";
import { ISGMX } from "../interfaces/gmx/ISGMX.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";


/**
 * @title   GMXIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GMXIsolationModeTokenVaultV1 is
    IGMXIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GMXIsolationModeTokenVaultV1";
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_DEPOSIT_SOURCE_GLP_VAULT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceGLPVault")) - 1); // solhint-disable-line max-line-length

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IERC20 gmx = IERC20(registry().gmx());
        gmx.safeApprove(glpVault, _amount);
        IGLPIsolationModeTokenVaultV2(glpVault).stakeGmx(_amount);
    }

    function unstakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(_amount);
    }

    function vestGmx(uint256 _esGmxAmount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).vestGmx(_esGmxAmount);
    }

    function unvestGmx(bool _shouldStakeGmx) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unvestGmx(_shouldStakeGmx, /* _addDepositIntoDolomite = */ true);
    }

    function setShouldSkipTransfer(bool _shouldSkipTransfer) external onlyVaultFactory(msg.sender) {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function setIsDepositSourceGLPVault(bool _isDepositSourceGLPVault) external onlyVaultFactory(msg.sender) {
        _setUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT, _isDepositSourceGLPVault ? 1 : 0);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    ) 
    public
    override
    onlyVaultFactory(msg.sender) {
        // @audit Make sure that shouldSkipTransfer and isDepositSourceGLPVault are always reset
        // There was issue with a test where if 0 was depositted from the GLP vault, it would not be reset
        if(shouldSkipTransfer()) {
            _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, 0);
        } else if (isDepositSourceGLPVault()) {
            address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());

            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(glpVault, address(this), _amount);
            _setUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT, 0);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        uint256 underlyingBal = super.underlyingBalanceOf();
        if (underlyingBal < _amount) {
            address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
            assert(glpVault != address(0));

            IERC20 sbfGmx = IERC20(registry().sbfGmx());
            uint256 sGmxStakedAmount = ISGMX(registry().sGmx()).stakedAmounts(glpVault);
            uint256 bnGmxAmount = IGLPIsolationModeTokenVaultV2(glpVault).claimAndStakeBnGmx();
            // @follow-up This can be off by 1 wei with rounding
            uint256 maxUnstakeAmount = sbfGmx.balanceOf(glpVault) * sGmxStakedAmount/ (sGmxStakedAmount + bnGmxAmount);

            uint256 diff = _amount - underlyingBal;
            if (maxUnstakeAmount >= diff) {
                IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(diff);
            } else {
                IGLPIsolationModeTokenVaultV2(glpVault).unvestGmx(
                    /* _shouldStakeGmx = */ false,
                    /* _addDepositIntoDolomite */ false
                );
                IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(diff);
            }
        }

        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function isDepositSourceGLPVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT) == 1;
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

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal override {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);

        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        IGLPIsolationModeTokenVaultV2(glpVault).sweep();
    } 
}