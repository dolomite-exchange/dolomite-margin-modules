// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title OnlyDolomiteMargin
 * @author Dolomite
 *
 * Inheritable contract that restricts the calling of certain functions to DolomiteMargin only
 */
contract OnlyDolomiteMargin {

    // ============ Constants ============

    bytes32 constant FILE = "OnlyDolomiteMargin";

    // ============ Storage ============

    IDolomiteMargin public immutable DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin
    )
    public
    {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ Modifiers ============

    modifier onlyDolomiteMargin(address _from) {
        Require.that(
            _from == address(DOLOMITE_MARGIN),
            FILE,
            "Only Dolomite can call function",
            _from
        );
        _;
    }
}
