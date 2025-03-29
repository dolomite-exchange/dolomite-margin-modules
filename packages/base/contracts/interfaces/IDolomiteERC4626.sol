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

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IDolomiteRegistry } from "./IDolomiteRegistry.sol";


/**
 * @title   IDolomiteERC4626
 * @author  Dolomite
 *
 * @notice  Interface that defines an ERC4626 wrapper around a user's Dolomite balance.
 */
interface IDolomiteERC4626 is IERC4626 {

    struct MetadataStruct {
        string name;
        string symbol;
        uint8 decimals;
    }

    function isValidReceiver(address _receiver) external view returns (bool);

    function marketId() external view returns (uint256);

    function DOLOMITE_REGISTRY() external view returns (IDolomiteRegistry);
}