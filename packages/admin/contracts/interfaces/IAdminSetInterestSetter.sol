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
 * @title   IAdminSetInterestSetter
 * @author  Dolomite
 *
 * @notice  Interface for the AdminSetInterestSetter contract
 */
interface IAdminSetInterestSetter {
    event ModularInterestSetterSet(address interestSetter);

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    function ownerSetModularInterestSetter(address _modularInterestSetter) external;

    // ========================================================
    // ==================== Public Functions ==================
    // ========================================================

    function setInterestSetterByMarketId(uint256 _marketId, address _interestSetter) external;

    function setModularInterestSetterByMarketId(uint256 _marketId) external;

    function setInterestSettingsByToken(
        address _token,
        uint256 _lowerOptimalPercent,
        uint256 _upperOptimalPercent,
        uint256 _optimalUtilization
    ) external;
}
