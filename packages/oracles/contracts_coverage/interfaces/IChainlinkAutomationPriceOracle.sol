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

import { IOnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/interfaces/IOnlyDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IChainlinkAutomation } from "./IChainlinkAutomation.sol";


/**
 * @title   IChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  A contract that implements the IDolomitePriceOracle interface using Chainlink Automation
 */
interface IChainlinkAutomationPriceOracle is IDolomitePriceOracle, IChainlinkAutomation, IOnlyDolomiteMargin {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event HeartbeatSet(uint256 _heartbeat);

    event GracePeriodSet(uint256 _heartbeat);

    event UpperEdgeSet(uint256 _upperEdge);

    event LowerEdgeSet(uint256 _lowerEdge);

    event ChainlinkRegistrySet(address _chainlinkRegistry);

    event ForwarderSet(address _forwarder);

    event ExchangeRateUpdated(
        uint256 _lastUpdateTimestamp,
        uint256 _exchangeRateNumerator,
        uint256 _exchangeRateDenominator
    );

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    /**
     *
     * @param  _heartbeat   The new heartbeat for Chainlink automation
     */
    function ownerSetHeartbeat(uint256 _heartbeat) external;

    /**
     *
     * @param  _gracePeriod   The new grace period for the getPrice function
     */
    function ownerSetGracePeriod(uint256 _gracePeriod) external;

    /**
     *
     * @param  _upperEdge   The new deviation upper edge for Chainlink automation
     */
    function ownerSetUpperEdge(uint256 _upperEdge) external;

    /**
     *
     * @param  _lowerEdge   The new deviation lower edge for Chainlink automation
     */
    function ownerSetLowerEdge(uint256 _lowerEdge) external;

    /**
     *
     * @param  _chainlinkRegistry   The new address of the chainlink registry
     */
    function ownerSetChainlinkRegistry(address _chainlinkRegistry) external;

    /**
     *
     * @param  _forwarder   The new address of the chainlink forwarder for interacting with this contract
     */
    function ownerSetForwarder(address _forwarder) external;

    // ========================================================
    // ================= Other Write Functions ================
    // ========================================================

    /**
     *
     * @param  _upkeepId   The ID of the upkeep to initialize the forwarder for
     */
    function initializeForwarder(uint256 _upkeepId) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function heartbeat() external view returns (uint256);

    function gracePeriod() external view returns (uint256);

    function upperEdge() external view returns (uint256);

    function lowerEdge() external view returns (uint256);

    function chainlinkRegistry() external view returns (address);

    function exchangeRateNumerator() external view returns (uint256);

    function exchangeRateDenominator() external view returns (uint256);

    function lastUpdateTimestamp() external view returns (uint256);
}
