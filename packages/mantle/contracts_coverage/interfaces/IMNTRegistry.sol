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

import { IBaseRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IBaseRegistry.sol";
import { IMantleRewardStation } from "./IMantleRewardStation.sol";


/**
 * @title   IMNTRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with Mantle
 */
interface IMNTRegistry is IBaseRegistry {

    event MantleRewardStationSet(address _station);

    function ownerSetMantleRewardStation(address _mantleRewardStation) external;

    function mantleRewardStation() external view returns (IMantleRewardStation);
}
