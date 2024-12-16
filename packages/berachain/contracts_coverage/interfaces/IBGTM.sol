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


/**
 * @title   IBGTM
 * @author  Dolomite
 *
 */
interface IBGTM {

    function deposit(address vaultAddress) external;

    function redeem(uint256 amount) external;

    function delegate(address validator, uint256 amount) external;

    function activate(address validator) external;

    function cancel(address validator, uint256 amount) external;

    function unbond(address validator, uint256 amount) external;

    function getBalance(address user) external view returns (uint256);

    function pending(address validator, address owner) external view returns (uint256);

    function queued(address validator, address owner) external view returns (uint256);

    function confirmed(address validator, address owner) external view returns (uint256);
}
