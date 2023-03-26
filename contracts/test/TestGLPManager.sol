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

import { IGLPManager } from "../external/interfaces/IGLPManager.sol";


/**
 * @title   TestGlpManager
 * @author  Dolomite
 *
 * @notice  A contract for testing pieces of the GLP Manager's functionality
 */
contract TestGLPManager is IGLPManager {

    uint256 private _aumInUsdg;

    function setAumInUsdg(uint256 _newAumInUsdg) external {
        _aumInUsdg = _newAumInUsdg;
    }

    function getAumInUsdg(bool) external view returns (uint256) {
        return _aumInUsdg;
    }
}
