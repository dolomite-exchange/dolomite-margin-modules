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

import { IsolationModeTokenVaultV1 } from "./abstract/IsolationModeTokenVaultV1.sol";


/**
 * @title   SimpleIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  A simple implementation (for an upgradeable proxy) for wrapping tokens via a per-user vault that can be used
 *          with DolomiteMargin. There are no functions to implement, so the implementation is empty.
 */
abstract contract SimpleIsolationModeTokenVaultV1 is IsolationModeTokenVaultV1 {
    // solhint-disable-previous-line no-empty-blocks
}
