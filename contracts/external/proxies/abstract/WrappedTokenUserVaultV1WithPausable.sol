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

import { WrappedTokenUserVaultV1 } from "./WrappedTokenUserVaultV1.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   WrappedTokenUserVaultV1WithPausable
 * @author  Dolomite
 *
 * @notice  An abstract implementation of WrappedTokenUserVaultV1 that disallows borrows if the ecosystem integration is
 *          paused.
 */
abstract contract WrappedTokenUserVaultV1WithPausable is WrappedTokenUserVaultV1 {
    using TypesLib for IDolomiteMargin.Par;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "WrappedTokenUserVaultV1Pausable";

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        external
        override
        onlyVaultOwner(msg.sender)
    {
        IDolomiteMargin.TotalPar memory valueBefore = DOLOMITE_MARGIN().getMarketTotalPar(_marketId);

        _transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        IDolomiteMargin.TotalPar memory valueAfter = DOLOMITE_MARGIN().getMarketTotalPar(_marketId);

        if (_isEcosystemPaused()) {
            // If the ecosystem is paused, the borrowed value should not increase
            Require.that(
                valueAfter.borrow <= valueBefore.borrow,
                _FILE,
                "Borrow cannot go up when paused",
                _marketId
            );
        }
    }

    // ===================================================
    // ================ Abstract Functions ===============
    // ===================================================

    function _isEcosystemPaused() internal virtual view returns (bool);

}
