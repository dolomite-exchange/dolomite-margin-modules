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

import {IChainlinkAutomationPriceOracle} from "../interfaces/IChainlinkAutomationPriceOracle.sol";
import {IDolomiteMargin} from "../../protocol/interfaces/IDolomiteMargin.sol";
import {IDolomiteStructs} from "../../protocol/interfaces/IDolomiteStructs.sol";
import {OnlyDolomiteMargin} from "../helpers/OnlyDolomiteMargin.sol";

import {Require} from "../../protocol/lib/Require.sol";

import "hardhat/console.sol";

/**
 * @title   ChainlinkAutomationPriceOracle.sol
 * @author  Dolomite
 *
 * @notice  An abstract contract that implements the IDolomitePriceOracle interface
 * @notice  Contains variables and functions for Chainlink Automation
 */
abstract contract ChainlinkAutomationPriceOracle is IChainlinkAutomationPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "ChainlinkAutomationPriceOracle";

    // ============================ Public State Variables ============================

    uint256 public HEARTBEAT = 12 * 3600;
    uint256 public GRACE_PERIOD = 3600;
    uint256 public UPPER_EDGE = 10025;
    uint256 public LOWER_EDGE = 9975;
    address public CHAINLINK_REGISTRY; // solhint-disable-line var-name-mixedcase

    uint256 public exchangeRate;
    uint256 public latestTimestamp;

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        CHAINLINK_REGISTRY = _chainlinkRegistry;
    }

    function ownerSetHeartbeat(uint256 _heartbeat) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHeartbeat(_heartbeat);
    }

    function ownerSetGracePeriod(uint256 _gracePeriod) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGracePeriod(_gracePeriod);
    }

    function ownerSetUpperEdge(uint256 _upperEdge) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUpperEdge(_upperEdge);
    }

    function ownerSetLowerEdge(uint256 _lowerEdge) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetLowerEdge(_lowerEdge);
    }

    function ownerSetChainlinkRegistry(address _chainlinkRegistry) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetChainlinkRegistry(_chainlinkRegistry);
    }

    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory /* performData */) {
        Require.that(
            tx.origin == address(0),
            _FILE,
            "static rpc calls only"
        );

        return (_checkUpkeepConditions(), '0x');
    }

    function performUpkeep(bytes calldata performData) external {
        Require.that(
            msg.sender == CHAINLINK_REGISTRY,
            _FILE,
            "caller is not Chainlink"
        );
        Require.that(
            _checkUpkeepConditions(),
            _FILE,
            "checkUpkeep conditions not met"
        );

        exchangeRate = _getExchangeRate();
        latestTimestamp = block.timestamp;
    }

    // ============================ Internal Functions ============================

    function _ownerSetHeartbeat(uint256 _heartbeat) internal {
        emit HeartbeatSet(_heartbeat);
        HEARTBEAT = _heartbeat;
    }

    function _ownerSetGracePeriod(uint256 _gracePeriod) internal {
        emit GracePeriodSet(_gracePeriod);
        GRACE_PERIOD = _gracePeriod;
    }

    function _ownerSetUpperEdge(uint256 _upperEdge) internal {
        Require.that(
            _upperEdge > 10000,
            _FILE,
            "Invalid upper edge"
        );
        emit UpperEdgeSet(_upperEdge);
        UPPER_EDGE = _upperEdge;
    }

    function _ownerSetLowerEdge(uint256 _lowerEdge) internal {
        Require.that(
            _lowerEdge < 10000,
            _FILE,
            "Invalid lower edge"
        );
        emit LowerEdgeSet(_lowerEdge);
        LOWER_EDGE = _lowerEdge;
    }

    function _ownerSetChainlinkRegistry(address _chainlinkRegistry) internal {
        Require.that(
            _chainlinkRegistry != address(0),
            _FILE,
            "Invalid chainlink registry"
        );
        emit ChainlinkRegistrySet(_chainlinkRegistry);
        CHAINLINK_REGISTRY = _chainlinkRegistry;
    }

    function _checkUpkeepConditions() internal view returns (bool) {
        uint256 _cachedExchangeRate = exchangeRate;
        uint256 _currentExchangeRate = _getExchangeRate();

        uint256 upperEdge = _cachedExchangeRate * UPPER_EDGE / 10000;
        uint256 lowerEdge = _cachedExchangeRate * LOWER_EDGE / 10000;
        return (_currentExchangeRate >= upperEdge || _currentExchangeRate <= lowerEdge || block.timestamp >= latestTimestamp + HEARTBEAT);
    }

    // ============================ Virtual Functions ============================

    function _getExchangeRate() internal virtual view returns (uint256);

    function _getCurrentPrice() internal virtual view returns (uint256);
}
