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

import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import {IOnlyDolomiteMargin} from "./IOnlyDolomiteMargin.sol";
import {IDolomitePriceOracle} from "../../protocol/interfaces/IDolomitePriceOracle.sol";

/**
 * @title   IChainlinkAutomationPriceOracle.sol
 * @author  Dolomite
 *
 * @notice  An abstract contract that implements the IDolomitePriceOracle interface
 * @notice  Contains variables and functions for Chainlink Automation
 */
interface IChainlinkAutomationPriceOracle is IDolomitePriceOracle, AutomationCompatibleInterface, IOnlyDolomiteMargin {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event HeartbeatSet(uint256 _heartbeat);

    event GracePeriodSet(uint256 _heartbeat);

    event UpperEdgeSet(uint256 _upperEdge);

    event LowerEdgeSet(uint256 _lowerEdge);

    event ChainlinkRegistrySet(address _chainlinkRegistry);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetHeartbeat(uint256 _heartbeat) external;

    function ownerSetGracePeriod(uint256 _gracePeriod) external;

    function ownerSetUpperEdge(uint256 _upperEdge) external;

    function ownerSetLowerEdge(uint256 _lowerEdge) external;

    function ownerSetChainlinkRegistry(address _chainlinkRegistry) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function HEARTBEAT() external view returns (uint256);

    function GRACE_PERIOD() external view returns (uint256);

    function UPPER_EDGE() external view returns (uint256);

    function LOWER_EDGE() external view returns (uint256);

    function CHAINLINK_REGISTRY() external view returns (address);

    function exchangeRateNumerator() external view returns (uint256);

    function exchangeRateDenominator() external view returns (uint256);

    function latestTimestamp() external view returns (uint256);
}
