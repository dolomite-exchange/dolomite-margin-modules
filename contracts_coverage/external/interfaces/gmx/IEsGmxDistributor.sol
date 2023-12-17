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


/**
 * @title   IEsGmxDistributor
 * @author  Dolomite
 *
 * @notice  Interface for setting the rewards that are distributed to fsGLP holders. Useful for testing esGMX
 *          functionality.
 */
interface IEsGmxDistributor {

    /**
     * @notice          Only callable by `admin()`
     *
     * @param  _amount  The amount of esGMX tokens to distribute per second.
     */
    function setTokensPerInterval(uint256 _amount) external;

    /**
     * @return The admin of this contract.
     */
    function admin() external view returns (address);
}
