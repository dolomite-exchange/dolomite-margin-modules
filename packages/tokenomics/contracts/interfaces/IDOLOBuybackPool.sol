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
 * @title   IDOLOBuybackPool
 * @author  Dolomite
 *
 * @notice  Interface for DOLO buyback pool
 */
interface IDOLOBuybackPool {

    event ExchangeRateSet(uint256 exchangeRate);

    function exchange(uint256 _paymentAmount) external;

    function ownerSetExchangeRate(uint256 _exchangeRate) external;

    function ownerWithdrawODolo(address _receiver) external;
}
