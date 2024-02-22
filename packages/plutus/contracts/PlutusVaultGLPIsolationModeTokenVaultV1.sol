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
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithPausable.sol"; // solhint-disable-line max-line-length
import { DolomiteMarginMath } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DolomiteMarginMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPlutusVaultGLP } from "./interfaces/IPlutusVaultGLP.sol";
import { IPlutusVaultGLPFarm } from "./interfaces/IPlutusVaultGLPFarm.sol";
import { IPlutusVaultGLPIsolationModeTokenVaultV1 } from "./interfaces/IPlutusVaultGLPIsolationModeTokenVaultV1.sol";
import { IPlutusVaultGLPIsolationModeVaultFactory } from "./interfaces/IPlutusVaultGLPIsolationModeVaultFactory.sol";
import { IPlutusVaultRegistry } from "./interfaces/IPlutusVaultRegistry.sol";


/**
 * @title   PlutusVaultGLPIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the plvGLP token that can be used
 *          to credit a user's Dolomite balance. plvGLP held in the vault is considered to be in isolation mode - that
 *          is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract PlutusVaultGLPIsolationModeTokenVaultV1 is
    IPlutusVaultGLPIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    using DolomiteMarginMath for uint256;
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PlvGLPIsolationModeTokenVaultV1";

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function harvest() external override onlyVaultOwner(msg.sender) {
        plvGlpFarm().harvest();
        _withdrawAllPls(msg.sender);
    }

    function stakePlvGlp(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        _stakePlvGlp(_amount);
    }

    function unstakePlvGlp(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        plvGlpFarm().withdraw(_amount.to96());
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
        public
        override
        onlyVaultFactory(msg.sender)
    {
        super.executeDepositIntoVault(_from, _amount);
        _stakePlvGlp(_amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
        public
        override
        onlyVaultFactory(msg.sender)
    {
        uint256 unstakedBalance = super.underlyingBalanceOf();
        if (unstakedBalance < _amount) {
            // There's not enough plvGLP in the vault to cover the withdrawal, so we need to withdraw from the staking
            // contract
            IPlutusVaultGLPFarm _plvGlpFarm = plvGlpFarm();
            if (_plvGlpFarm.paused()) {
                // if the farm is paused we need to emergency withdraw
                _plvGlpFarm.emergencyWithdraw();
            } else {
                _plvGlpFarm.withdraw(_amount.to96() - unstakedBalance.to96());
            }
        }

        assert(_recipient != address(this));

        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function plvGlpFarm() public view override returns (IPlutusVaultGLPFarm) {
        return registry().plvGlpFarm();
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        (uint96 stakedBalance,) = plvGlpFarm().userInfo(address(this));
        return stakedBalance + super.underlyingBalanceOf();
    }

    function pls() public view override returns (IERC20) {
        return registry().plutusToken();
    }

    function registry() public view returns (IPlutusVaultRegistry) {
        return IPlutusVaultGLPIsolationModeVaultFactory(VAULT_FACTORY()).plutusVaultRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        (,,bool canRedeem,) = IPlutusVaultGLP(UNDERLYING_TOKEN()).vaultParams();
        return !canRedeem;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _withdrawAllPls(address _recipient) internal {
        IERC20 _pls = pls();
        _pls.safeTransfer(_recipient, _pls.balanceOf(address(this)));
    }

    function _stakePlvGlp(uint256 _amount) internal {
        IERC20 plvGlp = IERC20(UNDERLYING_TOKEN());
        IPlutusVaultGLPFarm farm = plvGlpFarm();
        plvGlp.safeApprove(address(farm), _amount);
        farm.deposit(_amount.to96());
    }
}
