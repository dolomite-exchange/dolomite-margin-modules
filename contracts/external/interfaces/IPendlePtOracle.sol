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
 * @title   IPendlePtOracle
 * @author  Dolomite
 *
 * @notice  The vault contract used by GMX for holding the assets that back GLP.
 */
interface IPendlePtOracle {

    /**
     * Gets the TWAP rate of PT/Asset for the given market and duration
     *
     * @param  _market   The market to get the rate from
     * @param  _duration The TWAP duration (in seconds)
     * @return the TWAP rate PT/Asset on market (uses 18 decimals of precision)
     */
    function getPtToAssetRate(
        address _market,
        uint32 _duration
    ) external view returns (uint256);

    /**
     * Gets the state of the oracle (whether or not it can be validly accessed now for the given market and duration)
     *
     * @param  _market   The market to check that oracle state for
     * @param  _duration The TWAP duration (in seconds)
     */
    function getOracleState(
        address _market,
        uint32 _duration
    )
        external
        view
        returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied);
}
