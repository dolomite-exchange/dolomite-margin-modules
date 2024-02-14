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
 * @title   ITestAsyncProtocol
 * @author  Dolomite
 *
 * @notice  Interface for TestAsyncProtocol
 */
interface ITestAsyncProtocol {

    struct Deposit {
        address token;
        address to;
        uint256 minAmount;
        uint256 amount;
    }

    struct Withdrawal {
        address token;
        address to;
        uint256 amountIn;
        uint256 amountOut;
    }

    function createDeposit(address _token, uint256 _amount) external returns (bytes32);

    function executeDeposit(bytes32 _key, uint256 _amount) external;

    function cancelDeposit(bytes32 _key) external;

    function createWithdrawal(address _token, uint256 _amount) external returns (bytes32);

    function executeWithdrawal(bytes32 _key, uint256 _amount) external;

    function cancelWithdrawal(bytes32 _key) external;
}
