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
 * @title   IPlutusVaultGLPRouter
 * @author  Dolomite
 *
 * @notice  Interface for depositing/withdrawing plvGLP to/from the PlutusVaultGLPRouter contract.
 */
interface IPlutusVaultGLPRouter {

    function deposit(uint256 _amount) external;

    function withdraw(uint256 _shares) external;

    function getFeeBp(address _user) external view returns (uint256 _exitFeeBp, uint256 _rebateBp);

    function paused() external view returns (bool);

    function owner() external view returns (address);
}
