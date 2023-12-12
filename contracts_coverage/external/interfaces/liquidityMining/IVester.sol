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

import { IOARB } from "./IOARB.sol";


/**
 * @title   IVesterV1.sol
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

    struct BaseUriStorage {
        string baseUri;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event VestingStarted(address indexed owner, uint256 duration, uint256 amount, uint256 vestingId);
    event PositionClosed(address indexed owner, uint256 vestingId, uint256 ethCostPaid);
    event PositionForceClosed(address indexed owner, uint256 vestingId, uint256 arbTax);
    event EmergencyWithdraw(address indexed owner, uint256 vestingId, uint256 arbTax);
    event VestingActiveSet(bool vestingActive);
    event OARBSet(address oARB);
    event ClosePositionWindowSet(uint256 closePositionWindow);
    event EmergencyWithdrawTaxSet(uint256 emergencyWithdrawTax);
    event ForceClosePositionTaxSet(uint256 forceClosePositionTax);
    event PromisedArbTokensSet(uint256 promisedArbTokensSet);
    event VestingPositionCreated(VestingPosition vestingPosition);
    event VestingPositionCleared(uint256 id);
    event BaseURISet(string baseURI);

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    /**
     * @notice Allows the owner to withdraw ARB from the contract, potentially bypassing any reserved amounts
     *
     * @param  _to                              The address to send the ARB to
     * @param  _amount                          The amount of ARB to send
     * @param  _shouldBypassAvailableAmounts    True if the available balance should be checked first, false otherwise.
     *                                          Bypassing should only be used under emergency scenarios in which the
     *                                          owner needs to pull all of the funds
     */
    function ownerWithdrawArb(
        address _to,
        uint256 _amount,
        bool _shouldBypassAvailableAmounts
    ) external;

    /**
     * @notice  Sets isVestingActive. Callable by Dolomite Margin owner
     *
     * @param  _isVestingActive   True if creating new vests is allowed, or false to disable it
     */
    function ownerSetIsVestingActive(bool _isVestingActive) external;

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

    /**
     * @notice  Sets the base URI for the NFT's metadata. Callable by Dolomite Margin owner
     *
     * @param  _baseUri The URI that will be used for getting the NFT's image
     */
    function ownerSetBaseURI(string memory _baseUri) external;

    // ======================================================
    // ================== User Functions ====================
    // ======================================================

    /**
     * @notice  Initializes the oARB address
     *
     * @param  _oARB    oARB token address
     * @param  _baseUri The URI that will be used for getting the NFT's image
     */
    function initialize(address _oARB, string calldata _baseUri) external;

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
     * @param  _id                  The id of the position that is fully vested
     * @param  _fromAccountNumber   The account number from which payment will be made
     * @param  _toAccountNumber     The account number to which the ARB will be sent
     * @param  _maxPaymentAmount    The maximum amount of ETH to pay for the position
     */
    function closePositionAndBuyTokens(
        uint256 _id,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _maxPaymentAmount
    ) external;

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

    /**
     * @return The amount of ARB tokens available for vesting. Vesting ARB tokens is reserved by pairing with oARB.
     */
    function availableArbTokens() external view returns (uint256);

    /**
     * @return The amount of ARB tokens committed to active oARB vesting positions
     */
    function promisedArbTokens() external view returns (uint256);

    /**
     *  @return The oARB token contract address
     */
    function oARB() external view returns (IOARB);

    /**
     * @return The duration in seconds that users may execute the matured positions before it becomes force-closed
     */
    function closePositionWindow() external view returns (uint256);

    /**
     * @return The tax rate the user incurs when a position is force closed after the `closePositionWindow`. Measured in
     *          basis points (10_000 = 100%).
     */
    function forceClosePositionTax() external view returns (uint256);

    /**
     * @return  The tax rate the user incurs when they emergency exit/withdraw from a position. Measured in basis points
     *          (10_000 = 100%).
     */
    function emergencyWithdrawTax() external view returns (uint256);

    /**
     * @return  True if vesting is active, false otherwise
     */
    function isVestingActive() external view returns (bool);

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overridden in child contracts.
     */
    function baseURI() external view returns (string memory);

    /**
     *
     * @param  _id  The id of the position to get
     * @return      The vesting position
     */
    function vestingPositions(uint256 _id) external pure returns (VestingPosition memory);
}
