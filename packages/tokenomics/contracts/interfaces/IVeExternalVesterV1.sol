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
import { IERC20Mintable } from "./IERC20Mintable.sol";
import { IVeToken } from "./IVeToken.sol";
import { IVesterDiscountCalculator } from "./IVesterDiscountCalculator.sol";


/**
 * @title   IVeExternalVesterV1
 * @author  Dolomite
 *
 * Interface for a vesting contract that offers users a discount on REWARD_TOKEN if they vest PAIR_TOKEN and oToken for
 * a length of time
 */
interface IVeExternalVesterV1 {

    // =================================================
    // ==================== Structs ====================
    // =================================================

    struct VestingPosition {
        address creator;
        uint256 id;
        uint256 startTime;
        uint256 duration;
        uint256 oTokenAmount;
        uint256 pairAmount;
    }

    struct BaseUriStorage {
        string baseUri;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event VestingStarted(
        address indexed owner,
        uint256 duration,
        uint256 oTokenAmount,
        uint256 pairAmount,
        uint256 vestingId
    );
    event PositionClosed(address indexed owner, uint256 vestingId, uint256 amountPaid);
    event PositionForceClosed(address indexed owner, uint256 vestingId, uint256 pairTax);
    event EmergencyWithdraw(address indexed owner, uint256 vestingId, uint256 pairTax);
    event VestingActiveSet(bool vestingActive);
    event DiscountCalculatorSet(address discountCalculator);
    event OTokenSet(address oToken);
    event ClosePositionWindowSet(uint256 closePositionWindow);
    event EmergencyWithdrawTaxSet(uint256 emergencyWithdrawTax);
    event ForceClosePositionTaxSet(uint256 forceClosePositionTax);
    event PromisedTokensSet(uint256 promisedTokens);
    event PushedTokensSet(uint256 pushedTokens);
    event VeTokenSet(address veToken);
    event VestingPositionCreated(VestingPosition vestingPosition);
    event VestingPositionCleared(uint256 id);
    event BaseURISet(string baseURI);

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    /**
     * @notice Allows the owner to withdraw tokens from the contract, potentially bypassing any reserved amounts
     *
     * @param  _amount  The amount of REWARD_TOKEN to deposit into this contract
     */
    function ownerDepositRewardToken(
        uint256 _amount
    ) external;

    /**
     * @notice Allows the owner to withdraw tokens from the contract, potentially bypassing any reserved amounts
     *
     * @param  _to                              The address to send the REWARD_TOKEN to
     * @param  _amount                          The amount of REWARD_TOKEN to send
     * @param  _shouldBypassAvailableAmounts    True if the available balance should be checked first, false otherwise.
     *                                          Bypassing should only be used under emergency scenarios in which the
     *                                          owner needs to pull all of the funds
     */
    function ownerWithdrawRewardToken(
        address _to,
        uint256 _amount,
        bool _shouldBypassAvailableAmounts
    ) external;

    /**
     * @notice  Sets isVestingActive. Callable by the owner
     *
     * @param  _isVestingActive   True if creating new vests is allowed, or false to disable it
     */
    function ownerSetIsVestingActive(bool _isVestingActive) external;

    /**
     * @notice Sets the discount calculator for all active positions. Callable by the current owner
     *
     * @param  _discountCalculator  The address of the discount calculator contract
     */
    function ownerSetDiscountCalculator(address _discountCalculator) external;

    /**
     * @notice  Sets the close position window. Callable by the owner
     *
     * @param  _closePositionWindow Close position window in seconds
     */
    function ownerSetClosePositionWindow(uint256 _closePositionWindow) external;

    /**
     * @notice  Sets the emergency withdraw tax. Callable by the owner
     * @dev     This must be an integer between 0 and 10_000
     *
     * @param  _emergencyWithdrawTax    Emergency withdraw tax amount
     */
    function ownerSetEmergencyWithdrawTax(uint256 _emergencyWithdrawTax) external;

    /**
     * @notice  Sets the force close position tax. Callable by the owner
     * @dev     This must be an integer between 0 and 10_000
     *
     * @param  _forceClosePositionTax`  Force close position tax amount
     */
    function ownerSetForceClosePositionTax(uint256 _forceClosePositionTax) external;

    /**
     * @notice  Sets the base URI for the NFT's metadata. Callable by the owner
     *
     * @param  _baseUri The URI that will be used for getting the NFT's image
     */
    function ownerSetBaseURI(string memory _baseUri) external;

    // ======================================================
    // ================== User Functions ====================
    // ======================================================

    function PAIR_MARKET_ID() external view returns (uint256);
    function PAIR_TOKEN() external view returns (IERC20);

    function PAYMENT_MARKET_ID() external view returns (uint256);
    function PAYMENT_TOKEN() external view returns (IERC20);

    function REWARD_MARKET_ID() external view returns (uint256);
    function REWARD_TOKEN() external view returns (IERC20);

    function VE_TOKEN() external view returns (IVeToken);

    /**
     *
     * @param  _data encoded bytes data that resolves to (address oToken, string _baseUri)
     */
    function initialize(bytes calldata _data) external;

    /**
     * @notice  Transfers PAIR_TOKEN and oToken from user's wallet to the contract and begins vesting
     * @dev     Duration must be at least 1 week, modulo of 1 week, and a maximum of 40 weeks (in seconds)
     *
     * @param  _duration            The vesting duration in seconds
     * @param  _amount              The amount of oToken to vest
     * @param  _maxPairAmount       The max amount the user is willing to pair with `_amount` of oToken
     * @return  The ID of the NFT that is issued to `msg.sender`
     */
    function vest(
        uint256 _duration,
        uint256 _amount,
        uint256 _maxPairAmount
    ) external returns (uint256);

    /**
     * @notice  Burns the vested oToken tokens and sends vested and newly purchased ARB to user's dolomite balance
     *
     * @param  _nftId               The id of the position that is fully vested
     * @param  _veTokenId           The id of the veToken that will receive the reward tokens
     * @param  _lockDuration        The duration to lock the veToken for (if creating a new one)
     * @param  _maxPaymentAmount    The maximum amount of ETH to pay for the position
     */
    function closePositionAndBuyTokens(
        uint256 _nftId,
        uint256 _veTokenId,
        uint256 _lockDuration,
        uint256 _maxPaymentAmount
    ) external returns (uint256);

    /**
     * @notice  Burns the vested oToken tokens and sends vested ARB back to position owner's dolomite balance
     *
     * @param  _id  The id of the position that is expired
     */
    function forceClosePosition(uint256 _id) external;

    /**
     * @notice  Emergency withdraws oToken tokens and ARB tokens back to users account
     *          WARNING: This cancels all vesting progress
     *
     * @param  _id  The id of the position to emergency withdraw
     */
    function emergencyWithdraw(uint256 _id) external;

    // =================================================
    // ================= View Functions ================
    // =================================================

    /**
     * @return The amount of tokens available for vesting. Vesting tokens is reserved by pairing with oToken.
     */
    function availableTokens() external view returns (uint256);

    /**
     * @return The amount of ARB tokens committed to active oToken vesting positions
     */
    function promisedTokens() external view returns (uint256);

    /**
     * @return The amount of REWARD_TOKENS tokens that have been donated by the admin to the oToken program for vesting.
     *          This does not include interest.
     */
    function pushedTokens() external view returns (uint256);

    /**
     * @return The address that discount calculator contract
     */
    function discountCalculator() external view returns (IVesterDiscountCalculator);

    /**
     *  @return The oToken token contract address
     */
    function oToken() external view returns (IERC20Mintable);

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
     * @param  _creator The address of the user who created the vesting position
     * @param  _id      The id of the vesting position
     * @return      The account number at which the user's paired funds are being vested
     */
    function calculateAccountNumber(address _creator, uint256 _id) external pure returns (uint256);

    /**
     *
     * @param  _id  The id of the position to get
     * @return      The vesting position
     */
    function vestingPositions(uint256 _id) external pure returns (VestingPosition memory);
}
