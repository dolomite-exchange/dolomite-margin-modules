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
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IPlutusVaultGLPFarm } from "../interfaces/IPlutusVaultGLPFarm.sol";
import { IPlutusVaultGLPWrappedTokenUserVaultFactory } from "../interfaces/IPlutusVaultGLPWrappedTokenUserVaultFactory.sol"; // solhint-disable-line max-line-length
import { IPlutusVaultGLPWrappedTokenUserVaultV1 } from "../interfaces/IPlutusVaultGLPWrappedTokenUserVaultV1.sol";
import { WrappedTokenUserVaultV1 } from "../proxies/abstract/WrappedTokenUserVaultV1.sol";


/**
 * @title   PlutusVaultGLPWrappedTokenUserVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the plvGLP token that can be used
 *          to credit a user's Dolomite balance. plvGLP held in the vault is considered to be in isolation mode - that
 *          is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract PlutusVaultGLPWrappedTokenUserVaultV1 is
    IPlutusVaultGLPWrappedTokenUserVaultV1,
    WrappedTokenUserVaultV1,
    ProxyContractHelpers
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PlvGLPWrappedTokenUserVaultV1";

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function harvest() external override onlyVaultOwner(msg.sender) {
        plvGlpFarm().harvest();
        _withdrawAllPls(msg.sender);
    }

    function stakePlvGlp(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        IERC20 plvGlp = IERC20(UNDERLYING_TOKEN());
        IPlutusVaultGLPFarm farm = plvGlpFarm();
        plvGlp.safeApprove(address(farm), _amount);
        farm.deposit(_amount);
    }

    function unstakePlvGlp(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        plvGlpFarm().withdraw(_amount);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        uint256 unstakedBalance = super.underlyingBalanceOf();
        if (unstakedBalance < _amount) {
            // There's not enough plvGLP in the vault to cover the withdrawal, so we need to withdraw from the staking
            // contract
            IPlutusVaultGLPFarm _plvGlpFarm = plvGlpFarm();
            if (_plvGlpFarm.paused()) {
                // if the farm is paused we need to emergency withdraw
                _plvGlpFarm.emergencyWithdraw();
            } else {
                _plvGlpFarm.withdraw(_amount - unstakedBalance);
            }
        }

        assert(_recipient != address(this));

        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function plvGlpFarm() public view override returns (IPlutusVaultGLPFarm) {
        return IPlutusVaultGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).plutusVaultRegistry().plvGlpFarm();
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        (uint256 stakedBalance,) = plvGlpFarm().userInfo(address(this));
        return stakedBalance + super.underlyingBalanceOf();
    }

    function pls() public view override returns (IERC20) {
        return IPlutusVaultGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).plutusVaultRegistry().plutusToken();
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _withdrawAllPls(address _recipient) internal {
        IERC20 _pls = pls();
        _pls.safeTransfer(_recipient, _pls.balanceOf(address(this)));
    }
}
