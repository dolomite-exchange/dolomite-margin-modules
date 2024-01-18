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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IChainlinkAutomationPriceOracle } from "./interfaces/IChainlinkAutomationPriceOracle.sol";
import { IChainlinkRegistry } from "./interfaces/IChainlinkRegistry.sol";


/**
 * @title   ChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  An abstract contract that implements the IChainlinkAutomationPriceOracle interface
 * @notice  Contains variables and functions for Chainlink Automation
 */
abstract contract ChainlinkAutomationPriceOracle is IChainlinkAutomationPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "ChainlinkAutomationPriceOracle";
    uint256 private constant _ONE_UNIT = 10 ** 18;

    // ============================ Public State Variables ============================

    uint256 public heartbeat;
    uint256 public gracePeriod;
    uint256 public upperEdge;
    uint256 public lowerEdge;
    address public chainlinkRegistry;
    address public forwarder;

    uint256 public exchangeRateNumerator;
    uint256 public exchangeRateDenominator;
    uint256 public lastUpdateTimestamp;

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _ownerSetHeartbeat(24 hours);
        _ownerSetGracePeriod(1 hours);
        _ownerSetUpperEdge(10_025);
        _ownerSetLowerEdge(9_975);
        _ownerSetChainlinkRegistry(_chainlinkRegistry);
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

    function ownerSetForwarder(address _forwarder) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetForwarder(_forwarder);
    }

    function initializeForwarder(uint256 _upkeepId) external {
        Require.that(
            forwarder == address(0),
            _FILE,
            "Forwarder already initialized"
        );
        _ownerSetForwarder(IChainlinkRegistry(chainlinkRegistry).getForwarder(_upkeepId));
    }

    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        // solhint-disable avoid-tx-origin
        Require.that(
            tx.origin == address(0),
            _FILE,
            "Static rpc calls only"
        );
        // solhint-enable avoid-tx-origin

        return (_checkUpkeepConditions(), bytes(""));
    }

    function performUpkeep(bytes calldata /* performData */) external {
        Require.that(
            msg.sender == forwarder,
            _FILE,
            "Caller is not forwarder"
        );
        Require.that(
            _checkUpkeepConditions(),
            _FILE,
            "checkUpkeep conditions not met"
        );

        _updateExchangeRateAndTimestamp();
    }

    // ============================ Internal Functions ============================

    function _ownerSetHeartbeat(uint256 _heartbeat) internal {
        heartbeat = _heartbeat;
        emit HeartbeatSet(_heartbeat);
    }

    function _ownerSetGracePeriod(uint256 _gracePeriod) internal {
        gracePeriod = _gracePeriod;
        emit GracePeriodSet(_gracePeriod);
    }

    function _ownerSetUpperEdge(uint256 _upperEdge) internal {
        Require.that(
            _upperEdge > 10_000,
            _FILE,
            "Invalid upper edge"
        );
        upperEdge = _upperEdge;
        emit UpperEdgeSet(_upperEdge);
    }

    function _ownerSetLowerEdge(uint256 _lowerEdge) internal {
        Require.that(
            _lowerEdge < 10_000,
            _FILE,
            "Invalid lower edge"
        );
        lowerEdge = _lowerEdge;
        emit LowerEdgeSet(_lowerEdge);
    }

    function _ownerSetChainlinkRegistry(address _chainlinkRegistry) internal {
        Require.that(
            _chainlinkRegistry != address(0),
            _FILE,
            "Invalid chainlink registry"
        );

        chainlinkRegistry = _chainlinkRegistry;
        emit ChainlinkRegistrySet(_chainlinkRegistry);
    }

    function _ownerSetForwarder(address _forwarder) internal {
        Require.that(
            _forwarder != address(0),
            _FILE,
            "Invalid forwarder"
        );

        forwarder = _forwarder;
        emit ForwarderSet(_forwarder);
    }

    function _updateExchangeRateAndTimestamp() internal {
        (exchangeRateNumerator, exchangeRateDenominator) = _getExchangeRate();
        lastUpdateTimestamp = block.timestamp;
        emit ExchangeRateUpdated(lastUpdateTimestamp, exchangeRateNumerator, exchangeRateDenominator);
    }

    function _checkUpkeepConditions() internal view returns (bool) {
        (uint256 currentNumerator, uint256 currentDenominator) = _getExchangeRate();
        if (currentDenominator == 0) {
            return false;
        }

        uint256 cachedExchangeRate = exchangeRateNumerator * _ONE_UNIT / exchangeRateDenominator;
        uint256 currentExchangeRate = currentNumerator * _ONE_UNIT / currentDenominator;

        uint256 upperExchangeRate = cachedExchangeRate * upperEdge / 10_000;
        uint256 lowerExchangeRate = cachedExchangeRate * lowerEdge / 10_000;
        return (
            currentExchangeRate >= upperExchangeRate ||
            currentExchangeRate <= lowerExchangeRate ||
            block.timestamp >= lastUpdateTimestamp + heartbeat
        );
    }

    function _checkIsPriceExpired() internal view {
        Require.that(
            lastUpdateTimestamp + heartbeat + gracePeriod > block.timestamp,
            _FILE,
            "Price is expired"
        );
    }

    // ============================ Virtual Functions ============================

    function _getExchangeRate() internal virtual view returns (uint256 numerator, uint256 denominator);

    function _getCurrentPrice() internal virtual view returns (uint256);
}
