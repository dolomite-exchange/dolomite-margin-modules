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

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { ITestAsyncProtocolCallbackReceiver } from './ITestAsyncProtocolCallbackReceiver.sol';
import { ITestAsyncProtocol } from './ITestAsyncProtocol.sol';


/**
 * @title   TestAsyncProtocol
 * @author  Dolomite
 *
 * @notice  Contract to emulate async deposits and withdrawals
 */
contract TestAsyncProtocol is ERC20, ITestAsyncProtocol {

    event DepositCreated(bytes32 key);
    event WithdrawalCreated(bytes32 key);

    // ============ Constants ============

    bytes32 private constant _FILE = "TestAsyncProtocol";

    // ============ Constructor ============

    constructor() ERC20("TestAsyncProtocol", "TAP") {
    }

    // ============ State variables ============

    mapping(bytes32 => Deposit) public deposits;
    mapping(bytes32 => Withdrawal) public withdrawals;
    mapping(address => uint256) public nonces;

    // ===================== Functions =====================

    function createDeposit(
        address _token,
        uint256 _amount
    ) external returns (bytes32) {
        nonces[msg.sender] += 1;
        bytes32 key = keccak256(abi.encodePacked(_token, _amount, nonces[msg.sender]));
        deposits[key] = Deposit({
            token: _token,
            to: msg.sender,
            minAmount: _amount,
            amount: 0
        });
        emit DepositCreated(key);

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        return key;
    }

    function executeDeposit(
        bytes32 _key,
        uint256 _amount
    ) external {
        Deposit memory deposit = deposits[_key];
        delete deposits[_key];

        deposit.amount = _amount == 0 ? deposit.minAmount : _amount;
        _mint(deposit.to, deposit.amount);       
        ITestAsyncProtocolCallbackReceiver(deposit.to).afterDepositExecution(_key, deposit);
    }

    function cancelDeposit(
        bytes32 _key
    ) external {
        Deposit memory deposit = deposits[_key];
        delete deposits[_key];

        IERC20(deposit.token).transfer(deposit.to, deposit.minAmount);
        ITestAsyncProtocolCallbackReceiver(deposit.to).afterDepositCancellation(_key, deposit);
    }

    function createWithdrawal(
        address _token,
        uint256 _amount
    ) external returns (bytes32) {
        _burn(msg.sender, _amount);
        nonces[msg.sender] += 1;
        bytes32 key = keccak256(abi.encodePacked(_token, _amount, nonces[msg.sender]));
        withdrawals[key] = Withdrawal({
            token: _token,
            to: msg.sender,
            amountIn: _amount,
            amountOut: 0
        });
        emit WithdrawalCreated(key);
        return key;
    }

    function executeWithdrawal(
        bytes32 _key,
        uint256 _amount
    ) external {
        Withdrawal memory withdrawal = withdrawals[_key];
        delete withdrawals[_key];

        withdrawal.amountOut = _amount == 0 ? withdrawal.amountIn : _amount;
        IERC20(withdrawal.token).transfer(withdrawal.to, withdrawal.amountOut);
        ITestAsyncProtocolCallbackReceiver(withdrawal.to).afterWithdrawalExecution(_key, withdrawal);
    }

    function executeWithdrawalWithDifferentToken(
        bytes32 _key,
        uint256 _amount,
        address _token
    ) external {
        Withdrawal memory withdrawal = withdrawals[_key];
        delete withdrawals[_key];

        withdrawal.amountOut = _amount == 0 ? withdrawal.amountIn : _amount;
        IERC20(withdrawal.token).transfer(withdrawal.to, withdrawal.amountOut);
        withdrawal.token = _token;
        ITestAsyncProtocolCallbackReceiver(withdrawal.to).afterWithdrawalExecution(_key, withdrawal);
    }

    function cancelWithdrawal(
        bytes32 _key
    ) external {
        Withdrawal memory withdrawal = withdrawals[_key];
        delete withdrawals[_key];

        _mint(withdrawal.to, withdrawal.amountIn);
        ITestAsyncProtocolCallbackReceiver(withdrawal.to).afterWithdrawalCancellation(_key, withdrawal);
    }

    function addBalance(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}