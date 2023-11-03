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
 * @title   IVester
 * @author  Dolomite
 *
 * Interface for a vesting contract that offers users a discount on ARB tokens
 * if they vest ARB and oARB for a length of time
 */
interface IVester {

    // =================================================
    // ==================== Structs ====================
    // =================================================

    struct VestingPosition {
        address creator;
        uint256 id;
        uint256 startTime;
        uint256 duration;
        uint256 amount;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event Vesting(address indexed owner, uint256 duration, uint256 amount, uint256 vestingId);
    event PositionClosed(address indexed owner, uint256 vestingId);
    event EmergencyWithdraw(address indexed owner, uint256 vestingId);
    event VestingActiveSet(bool vestingActive);
    event OARBSet(address oARB);
    event ClosePositionWindowSet(uint256 _closePositionWindow);
    event EmergencyWithdrawTaxSet(uint256 _emergencyWithdrawTax);
    event ForceClosePositionTaxSet(uint256 _forceClosePositionTax);

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    /**
     * @notice  Sets vestingActive. Callable by Dolomite Margin owner
     *
     * @param  _vestingActive   The id of the position to emergency withdraw
     */
    function ownerSetVestingActive(bool _vestingActive) external;

    /**
     * @notice  Sets the oARB token address. Callable by Dolomite Margin owner
     *
     * @param  _oARB   oARB token address
     */
    function ownerSetOARB(address _oARB) external;

    /**
     * @notice  Sets the close position window. Callable by Dolomite Margin owner
     *
     * @param  _closePositionWindow Close position window in seconds
     */
    function ownerSetClosePositionWindow(uint256 _closePositionWindow) external;

    /**
     * @notice  Sets the emergency withdraw tax. Callable by Dolomite Margin owner
     * @dev     This must be an integer between 0 and 10_000
     *
     * @param  _emergencyWithdrawTax    Emergency withdraw tax amount
     */
    function ownerSetEmergencyWithdrawTax(uint256 _emergencyWithdrawTax) external;

    /**
     * @notice  Sets the force close position tax. Callable by Dolomite Margin owner
     * @dev     This must be an integer between 0 and 10_000
     *
     * @param  _forceClosePositionTax`  Force close position tax amount
     */
    function ownerSetForceClosePositionTax(uint256 _forceClosePositionTax) external;

    // ======================================================
    // ================== User Functions ===================
    // ======================================================

    /**
     * @notice  Initializes the oARB address
     *
     * @param  _oARB    oARB token address
     */
    function initialize(address _oARB) external;

    /**
     * @notice  Transfers ARB and oARB from user's dolomite balance to the contract and begins vesting
     * @dev     Duration must be 1 week, 2 weeks, 3 weeks, or 4 weeks in seconds
     *
     * @param  _fromAccountNumber   The account number to transfer ARB and oARB from
     * @param  _duration            The vesting duration
     * @param  _amount              The amount to vest
     */
    function vest(uint256 _fromAccountNumber, uint256 _duration, uint256 _amount) external returns (uint256);

    /**
     * @notice  Burns the vested oARB tokens and sends vested and newly purchased ARB to user's dolomite balance
     *
     * @param  _id  The id of the position that is fully vested
     */
    function closePositionAndBuyTokens(uint256 _id, uint256 _fromAccountNumber) external;

    /**
     * @notice  Burns the vested oARB tokens and sends vested ARB back to position owner's dolomite balance
     *
     * @param  _id  The id of the position that is expired
     */
    function forceClosePosition(uint256 _id) external;

    /**
     * @notice  Emergency withdraws oARB tokens and ARB tokens back to users account
     *          WARNING: This cancels all vesting progress
     *
     * @param  _id  The id of the position to emergency withdraw
     */
    function emergencyWithdraw(uint256 _id) external;

    // =================================================
    // ================= View Functions ================
    // =================================================
}