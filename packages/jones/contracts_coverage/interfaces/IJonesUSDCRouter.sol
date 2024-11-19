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


/**
 * @title   IJonesUSDCRouter
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's jUSDC router (0x9c895CcDd1da452eb390803d48155e38f9fC2e4d). The
 *          adapter serves as the primary entry/exit point for users looking to mint/redeem jUSDC.
 */
interface IJonesUSDCRouter {

    /**
     * @notice Mints Vault shares to receiver by depositing underlying tokens.
     *
     * @param  _assets      The amount of assets to deposit.
     * @param  _receiver    The address who will receive the shares.
     * @return The amount that were minted and received.
     */
    function deposit(uint256 _assets, address _receiver) external returns (uint256);

    /**
     * @notice Requests to withdraw the given amount of shares from the message sender's balance.
     * The withdrawal request will be added to the total amount of withdrawal requests, and will be
     * added to the user's total withdrawal requests.
     *
     * @param  _shares        The amount of shares to withdraw.
     * @param  _receiver      The address that will receive the assets.
     * @param  _minAmountOut  Min Amount that should be received.
     * @param  _enforceData   The data needed to enforce payback.
     * @return true if msg.sender bypass cooldown.
     * @return Amount of assets.
     */
    function withdrawRequest(
        uint256 _shares,
        address _receiver,
        uint256 _minAmountOut,
        bytes calldata _enforceData
    ) external returns (bool, uint256);

    /**
     * Pauses any depositing/withdrawing on the router
     */
    function pause() external;

    /**
     * @return True if depositing/withdrawing is now paused
     */
    function isPaused() external view returns (bool);
}
