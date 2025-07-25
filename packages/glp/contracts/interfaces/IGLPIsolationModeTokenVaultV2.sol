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

// solhint-disable max-line-length
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IGmxRegistryV1 } from "./IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "./IGmxRewardRouterV2.sol";
import { ISGMX } from "./ISGMX.sol";
// solhint-enable max-line-length


/**
 * @title   IGLPIsolationModeTokenVaultV2
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on the GLPIsolationModeTokenVaultV2 implementation
 *          contract for each user's proxy vault.
 */
interface IGLPIsolationModeTokenVaultV2 is IIsolationModeTokenVaultV1WithFreezable {

    function getGmxVaultOrCreate() external returns (address);

    /**
     * @notice  Allows the user to claim all rewards and stake them if the user wants to. This function must be called
     *          by the vault owner.
     *
     * @param  _shouldClaimGmx                  `true` to claim GMX tokens from vGLP and vGMX vesting contracts, or
     *                                          `false` to skip.
     * @param  _shouldStakeGmx                  `true` to stake the claimed GMX tokens in this vault, or `false` to send
     *                                          them to the vault's owner.
     * @param  _shouldClaimEsGmx                `true` to claim esGMX tokens from sGMX and sGLP contracts, or `false` to
     *                                          skip.
     * @param  _shouldStakeEsGmx                `true` to stake the claimed esGMX tokens in this vault, or `false`
     *                                          to keep them idle in the vault. These tokens are non-transferable to the
     *                                          vault's owner.
     * @param  _shouldStakeMultiplierPoints     `true` to stake the claimed multiplier points in this vault, or `false`
     *                                          to skip.
     * @param  _shouldClaimWeth                 `true` to claim WETH tokens fee-tracking GLP/GMX contracts, or `false`
     *                                          to skip.
     * @param  _shouldDepositWethIntoDolomite   `true` to deposit the claimed WETH tokens into the vault owner's
     *                                          Dolomite account, or `false` to send them to the vault owner.
     * @param  _depositAccountNumberForWeth     The account number to which the WETH tokens should be deposited if
     *                                          the user decides to deposit them into Dolomite.
     */
    function handleRewardsWithSpecificDepositAccountNumber(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    )
    external;

    /**
     * @notice  The same function as #handleRewardsWithSpecificDepositAccountNumber but defaults
     *          `_depositAccountNumberForWeth` to `0`.
     */
    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite
    )
    external;

    /**
     * @notice Transfers GMX tokens from the vault owner's account to this vault and stakes it.
     *
     * @param  _amount  The amount of GMX to stake. This function must be called by the vault owner.
     */
    function stakeGmx(uint256 _amount) external;

    /**
     * @notice Sends the unstaked GMX to the vault owner.
     *
     * @param  _amount  The amount of GMX to unstake. This function must be called by the vault owner.
     */
    function unstakeGmx(uint256 _amount) external;

    /**
     *
     * @param  _amount  The amount of esGMX to stake. This function must be called by the vault owner.
     */
    function stakeEsGmx(uint256 _amount) external;

    /**
     *
     * @param  _amount  The amount of esGMX to unstake. This function must be called by the vault owner.
     */
    function unstakeEsGmx(uint256 _amount) external;

    /**
     * @notice  Signals a full account transfer to the recipient. This function must be called by the gmx vault
     *
     * @param  _recipient   The address of the recipient who will receive this vault's entire account
     * @param  _glpBal      The account wei of the glp vault in the underlying glp market
     */
    function signalAccountTransfer(address _recipient, uint256 _glpBal) external;

    /**
     * @notice  Cancels a full account transfer that has already been signaled.
     *          This function must be called by the gmx vault
     *
     */
    function cancelAccountTransfer() external;

    /**
     * @notice  Accepts a full account transfer from the sender's GMX account. There must not be any tokens in vesting
     *          and this contract must not have interacted with GMX yet for this to function. This function must be
     *          called by the vault owner.
     *
     * @param  _sender  The address of the GMX account whose entire account will be transferred to this vault
     */
    function acceptFullAccountTransfer(address _sender) external;

    /**
     * @notice  Deposits `_esGmxAmount` into the vesting contract along with GLP to be converted into GMX tokens. This
     *          function must be called by the vault owner.
     *
     * @param  _esGmxAmount The amount of esGMX to deposit into the vesting contract.
     */
    function vestGlp(uint256 _esGmxAmount) external;

    /**
     * @notice  Withdraws all esGMX that is vesting along with the paired fsGLP tokens used to vest the esGMX. Any
     *          remaining esGMX stays in this vault (it's non-transferable) along with the withdrawn fsGLP. The vested
     *          GMX tokens are sent to the vault owner. This function must be called by the vault owner.
     *
     * @param  _shouldStakeGmx  `true` to stake the GMX tokens in this vault, or `false` to send them to the vault
     *                          owner.
     */
    function unvestGlp(bool _shouldStakeGmx) external;

    /**
     * @notice  Deposits `_esGmxAmount` into the vesting contract along with sbfGMX to be converted into GMX tokens.
     *          This function must be called by the vault owner.
     *
     * @param  _esGmxAmount The amount of esGMX to deposit into the vesting contract.
     */
    function vestGmx(uint256 _esGmxAmount) external;

    /**
     * @notice  Withdraws all esGMX that is vesting along with the paired sbfGMX tokens used to vest the esGMX. Any
     *          remaining esGMX stays in this vault (it's non-transferable) along with the withdrawn sbfGMX. The vested
     *          GMX tokens are sent to the vault owner. This function must be called by the vault owner.
     *
     * @param  _shouldStakeGmx  `true` to stake the GMX tokens in this vault, or `false` to send them to the vault
     *                          owner.
     */
    function unvestGmx(bool _shouldStakeGmx, bool _addDepositIntoDolomite) external;

    /**
     * @notice  Syncs the vault's GMX balance with the GMX vault. This function must be called by the GMX vault factory.
     *          All GMX tokens will remain in this vault, but the GMX vault's Dolomite Balance will be updated with the
     *          vault's balance.
     *
     * @param  _gmxVault  Matching GMX vault address for GLP vault owner
     */
    function sync(address _gmxVault) external;

    /**
     * @notice  Deposits any excess GMX balance in this GLP vault to the GMX vault. Does not touch staked-GMX
     */
    function sweepGmxTokensIntoGmxVault() external;

    /**
     * @return  The max amount of GMX tokens the user can unstake before having to unvest any paired GMX tokens for
     *          vesting
     */
    function maxGmxUnstakeAmount() external returns (uint256);

    /**
     * @return The registry used to get addresses from the GMX ecosystem
     */
    function registry() external view returns (IGmxRegistryV1);

    /**
     * @return The amount of GMX tokens the user owns
     */
    function gmxBalanceOf() external view returns (uint256);

    /**
     * @return The amount of esGMX tokens the user owns
     */
    function esGmxBalanceOf() external view returns (uint256);

    function gmx() external view returns (IERC20);

    function sGmx() external view returns (ISGMX);

    function gmxRewardsRouter() external view returns (IGmxRewardRouterV2);
}
