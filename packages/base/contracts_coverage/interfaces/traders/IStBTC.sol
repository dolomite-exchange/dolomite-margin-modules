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

/**
 * @title   IStBTC
 * @author  Dolomite
 *
 * @notice  Interface for StBTC
 */
interface IStBTC {

    function directDeposit(uint256 assets, address receiver) external payable returns (uint256);

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);

    function previewDeposit(uint256 assets) external view returns (uint256);

    function previewRedeem(uint256 shares) external view returns (uint256);
}
