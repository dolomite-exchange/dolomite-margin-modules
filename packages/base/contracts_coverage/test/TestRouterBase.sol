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

import { IIsolationModeTokenVaultV2 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV2.sol";
import { RouterBase } from "../routers/RouterBase.sol";


/**
 * @title   TestRouterBase
 * @author  Dolomite
 *
 * @notice  Test contract for RouterBase
 */
contract TestRouterBase is RouterBase {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "TestRouterBase";

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function getMarketInfo(uint256 _marketId) external view returns (MarketInfo memory) {
        return _getMarketInfo(_marketId);
    }

    function validateIsoMarketAndGetVault(
        uint256 _marketId,
        address _account
    ) external returns (IIsolationModeTokenVaultV2) {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        return _validateIsolationModeMarketAndGetVault(marketInfo, _account);
    }

    function isIsolationModeAsset(address _token) external view returns (bool) {
        return _isIsolationModeAsset(_token);
    }

    function isIsolationModeAssetByMarketId(uint256 _marketId) external view returns (bool) {
        return _isIsolationModeMarket(_marketId);
    }
}
