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

import { IVesterV1 } from "./IVesterV1.sol";


/**
 * @title   IVesterV2
 * @author  Dolomite
 *
 * Interface for a vesting contract that offers users a discount on ARB tokens
 * if they vest ARB and oARB for a length of time
 */
interface IVesterV2 is IVesterV1 {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event PositionDurationExtended(uint256 indexed vestingId, uint256 newDuration);
    event LevelRequestInitiated(address user, uint256 requestId);
    event LevelRequestFinalized(address user, uint256 requestId, uint256 level);
    event LevelRequestFeeSet(uint256 levelRequestFee);
    event LevelExpirationWindowSet(uint256 levelExpirationWindow);
    event LevelBoostThresholdSet(uint8 levelBoostThreshold);
    event HandlerSet(address handler, bool isHandler);

    // ================================================
    // ================== Functions ===================
    // ================================================

    /**
     *
     * @param  _levelExpirationWindow The new amount of time that a level is valid before it can be considered expired
     */
    function ownerSetLevelExpirationWindow(uint256 _levelExpirationWindow) external;

    /**
     *
     * @param  _levelRequestFee The new fee that must be sent by the user to initiate a level request update
     */
    function ownerSetLevelRequestFee(uint256 _levelRequestFee) external;

    /**
     *
     * @param  _levelBoostThreshold The new level at which the user is eligible to accelerate their vesting
     */
    function ownerSetLevelBoostThreshold(uint8 _levelBoostThreshold) external;

    /**
     *
     * @param  _handler     The address of the handler to set
     * @param  _isHandler   Whether or not the address is a handler
     */
    function ownerSetHandler(address _handler, bool _isHandler) external;

    /**
     *
     * @param  _nftId    The ID of the position to extend the duration for
     * @param  _duration The new duration to set for the position
     */
    function extendDurationForGrandfatheredPosition(uint256 _nftId, uint256 _duration) external;

    /**
     *
     * Initiates a request for `_user` to have their level updated. This will emit a `LevelRequestInitiated` event
     */
    function initiateLevelRequest(address _user) external payable;

    /**
     *
     * Finalizes a level request for `_user` with `_level`. This will emit a `LevelRequestFinalized` event
     *
     * @param  _requestId   The ID of the requests to finalize or 0 for no ID and to force update a user's level.
     * @param  _user        The user whose level should be updated
     * @param  _level       The level to set for the user
     */
    function handlerUpdateLevel(uint256 _requestId, address _user, uint256 _level) external;

    /**
     * Allows the handler to withdraw all ETH in this contract to a designated address
     *
     * @param  _to  The recipient of the ETH in this contract
     */
    function handlerWithdrawETH(address payable _to) external;

    /**
     * @return  The amount of time that a level is valid before it can be considered expired
     */
    function levelExpirationWindow() external view returns (uint256);

    /**
     *
     * @param  _user    The user whose level should be retrieved
     * @return The level of the user
     */
    function getLevelByUser(address _user) external view returns (uint256);

    /**
     *
     * @param  _user    The user whose level should be retrieved
     * @return The level of the user or 0 if the user's level is expired
     */
    function getEffectiveLevelByUser(address _user) external view returns (uint256);

    /**
     *
     * @param  _user    The user whose level request ID should be retrieved
     * @return The current level request being fulfilled or 0 for none
     */
    function getLevelRequestByUser(address _user) external view returns (uint256);

    /**
     *
     * @param  _user    The user whose expiration timestamp for their level should be retrieved
     * @return The timestamp at which the user's level expires or 0 if there is no expiration
     */
    function getLevelExpirationTimestampByUser(address _user) external view returns (uint256);

    /**
     *
     * @param  _handler The handler to check
     * @return Whether or not the address is a handler
     */
    function isHandler(address _handler) external view returns (bool);

    /**
     *
     * @return The last ID from a V1 position that was grandfathered into the old vesting regime.
     */
    function grandfatheredIdCutoff() external view returns (uint256);

    /**
     *
     * @return The amount of ETH required to initiate a level update request
     */
    function levelRequestFee() external view returns (uint256);

    /**
     *
     * @return The level at which the user can boost the speed of their vesting by 50%.
     */
    function levelBoostThreshold() external view returns (uint8);
}
