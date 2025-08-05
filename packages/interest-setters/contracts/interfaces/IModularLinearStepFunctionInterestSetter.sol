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

import { IDolomiteInterestSetter } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteInterestSetter.sol"; // solhint-disable-line max-line-length


/**
 * @title   IModularLinearStepFunctionInterestSetter
 * @author  Dolomite
 *
 * Interface for a contract that uses linear step functions to set interest rates.
 */
interface IModularLinearStepFunctionInterestSetter is IDolomiteInterestSetter {

    event SettingsChanged(
        address indexed token,
        uint256 lowerOptimalPercent,
        uint256 upperOptimalPercent,
        uint256 optimalUtilization
    );

    struct Settings {
        uint256 lowerOptimalPercent;
        uint256 upperOptimalPercent;
        uint256 optimalUtilization;
    }

    function ownerSetSettingsByToken(
        address _token,
        uint256 _lowerOptimalPercent,
        uint256 _upperOptimalPercent,
        uint256 _optimalUtilization
    ) external;

    function getSettingsByToken(address _token) external view returns (Settings memory);

    function getLowerOptimalPercentByToken(address _token) external view returns (uint256);

    function getUpperOptimalPercentByToken(address _token) external view returns (uint256);

    function getOptimalUtilizationByToken(address _token) external view returns (uint256);
}
