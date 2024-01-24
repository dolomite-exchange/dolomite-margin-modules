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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";


/**
 * @title   IIsolationModeFreezableLiquidatorProxy
 * @author  Dolomite
 *
 * @notice Interface for the implementation contract used by proxy user vault contracts.
 */
interface IIsolationModeFreezableLiquidatorProxy {

    // ===========================================================
    // ========================= Structs =========================
    // ===========================================================

    struct PrepareForLiquidationParams {
        IDolomiteMargin.AccountInfo liquidAccount;
        uint256 freezableMarketId;
        uint256 inputTokenAmount;
        uint256 outputMarketId;
        uint256 minOutputAmount;
        uint256 expirationTimestamp;
        bytes extraData;
    }

    // ===========================================================
    // ========================= Events ==========================
    // ===========================================================

    event MinOutputPercentageUpperBoundSet(uint256 newMinOutputPercentageUpperBound);

    // ===========================================================
    // ===================== Admin Functions =====================
    // ===========================================================

    function ownerSetMinOutputPercentageUpperBound(
        uint256 _minOutputPercentageUpperBound
    )
    external;

    // ===========================================================
    // ===================== Public Functions ====================
    // ===========================================================

    function prepareForLiquidation(
        PrepareForLiquidationParams calldata _params
    )
    external
    payable;
}
