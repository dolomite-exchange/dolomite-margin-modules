// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { SmartDebtAutoTrader } from "../smart-debt/SmartDebtAutoTrader.sol";


/**
 * @title   TestSmartDebtAutoTrader
 * @author  Dolomite
 *
 * @notice  Test contract for SmartDebtAutoTrader
 */
contract TestSmartDebtAutoTrader is SmartDebtAutoTrader {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "TestSmartDebtAutoTrader";

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _link,
        address _verifierProxy,
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) SmartDebtAutoTrader(_link, _verifierProxy, _chainId, _dolomiteRegistry, _dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function calculateOutputTokenAmount(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        PairPosition memory _pairPosition,
        uint256 _inputAmountWei,
        bytes memory _data
    ) external view returns (uint256) {
        return _calculateOutputTokenAmount(_inputMarketId, _outputMarketId, _pairPosition, _inputAmountWei, _data);
    }

    function calculateTotalFeePercentage(
        LatestReport memory _inputReport,
        LatestReport memory _outputReport,
        PairPosition memory _pairPosition
    ) external view returns (IDolomiteStructs.Decimal memory) {
        return _calculateTotalFeePercentage(_inputReport, _outputReport, _pairPosition);
    }

    function getVolatilityFeePercentage(
        LatestReport memory _inputReport,
        LatestReport memory _outputReport,
        FeeSettings memory _feeSettings
    ) external view returns (IDolomiteStructs.Decimal memory) {
        return _getVolatilityFeePercentage(_inputReport, _outputReport, _feeSettings);
    }

    function calculateTimeMultiplier(
        uint256 _oldestReportTimestamp,
        FeeSettings memory _feeSettings
    ) external view returns (uint256) {
        return _calculateTimeMultiplier(_oldestReportTimestamp, _feeSettings);
    }

    function getVolatilityLevel(
        LatestReport memory _report,
        FeeSettings memory _feeSettings
    ) external pure returns (VolatilityLevel) {
        return _getVolatilityLevel(_report, _feeSettings);
    }

    function min(uint256 _a, uint256 _b) external pure returns (uint256) {
        return _min(_a, _b);
    }
}
