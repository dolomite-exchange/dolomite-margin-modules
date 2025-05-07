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
 * @title   IVeFeeCalculator
 * @author  Dolomite
 *
 * @notice  Interface for vesting fee calculator
 */
interface IVeFeeCalculator {

    event BurnFeeSet(uint256 burnFee);

    function ownerSetBurnFee(uint256 _burnFee) external;

    /**
     * Calculates how much in fees the user will pay to exit their lock
     *
     * @param  _amount          The
     * @param  _lockEndTime     The timestamp at which the lock matures
     * @return  burnFeeAmount   The amount of fees to be burned
     * @return  recoupFeeAmount The amount of feed to be paid back to the DAO
     */
    function getEarlyWithdrawalFees(
        uint256 _amount,
        uint256 _lockEndTime
    ) external view returns (uint256 burnFeeAmount, uint256 recoupFeeAmount);
}
