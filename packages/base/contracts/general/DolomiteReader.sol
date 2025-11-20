// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";

/**
 * @title   DolomiteReader
 * @author  Dolomite
 *
 * @notice  Dolomite reader contract. Certain calls should only be done off-chain and are VERY gas intensive
 */
contract DolomiteReader {
    using DecimalLib for IDolomiteStructs.Decimal;
    using TypesLib for IDolomiteStructs.Wei;

    // ===================== Constants =====================

    bytes32 private constant _FILE = "DolomiteReader";

    IDolomiteMargin public immutable DOLOMITE_MARGIN;

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function getHealthFactor(
        IDolomiteStructs.AccountInfo memory accountInfo
    ) external view returns (IDolomiteStructs.Decimal memory) {
        IDolomiteStructs.Decimal memory marginRatio = DolomiteMarginVersionWrapperLib.getVersionedMarginRatioByAccount(
            DOLOMITE_MARGIN,
            block.chainid,
            accountInfo
        );
        marginRatio = marginRatio.onePlus();

        (
            IDolomiteStructs.MonetaryValue memory supplied,
            IDolomiteStructs.MonetaryValue memory borrowed
        ) = DOLOMITE_MARGIN.getAdjustedAccountValues(accountInfo);

        uint256 collat = supplied.value * 1 ether / borrowed.value;
        return IDolomiteStructs.Decimal({ value: collat * 1 ether / marginRatio.value });
    }

    function getAdjustedLtv(
        IDolomiteStructs.AccountInfo memory accountInfo
    ) external view returns (IDolomiteStructs.Decimal memory) {
        IDolomiteStructs.Decimal memory marginRatio = DolomiteMarginVersionWrapperLib.getVersionedMarginRatioByAccount(
            DOLOMITE_MARGIN,
            block.chainid,
            accountInfo
        );
        marginRatio = marginRatio.onePlus();

        (
            IDolomiteStructs.MonetaryValue memory supplied,
            IDolomiteStructs.MonetaryValue memory borrowed
        ) = DOLOMITE_MARGIN.getAdjustedAccountValues(accountInfo);

        return IDolomiteStructs.Decimal(
            { value: borrowed.value * 1 ether / supplied.value }
        );
    }

    function getHealthFactorWithChanges(
        IDolomiteStructs.AccountInfo memory accountInfo,
        uint256[] memory marketIds,
        IDolomiteStructs.Wei[] memory weiChanges
    ) external view returns (IDolomiteStructs.Decimal memory) {
    }

    function calculateMaxBorrowableAmountForMarket(
        address account,
        uint256 accountNumber,
        uint256 marketId
    ) external view returns (uint256) {

    }
}