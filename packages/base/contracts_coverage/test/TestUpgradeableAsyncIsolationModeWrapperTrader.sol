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

import { Require } from "../protocol/lib/Require.sol";
import { UpgradeableAsyncIsolationModeWrapperTrader } from "../isolation-mode/abstract/UpgradeableAsyncIsolationModeWrapperTrader.sol";
import { AsyncIsolationModeTraderBase } from "../isolation-mode/abstract/AsyncIsolationModeTraderBase.sol";
import { AsyncIsolationModeWrapperTraderImpl } from "../isolation-mode/abstract/impl/AsyncIsolationModeWrapperTraderImpl.sol";
import { ITestAsyncProtocolCallbackReceiver } from "./ITestAsyncProtocolCallbackReceiver.sol";
import { ITestAsyncProtocol } from "./ITestAsyncProtocol.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   TestUpgradeableAsyncIsolationModeWrapperTrader
 * @author  Dolomite
 *
 * @notice  Test contract for UpgradeableAsyncIsolationModeWrapperTrader
 */
contract TestUpgradeableAsyncIsolationModeWrapperTrader is
    UpgradeableAsyncIsolationModeWrapperTrader,
    ITestAsyncProtocolCallbackReceiver
{

    // ============ Variables ============

    bytes32 private constant _FILE = "TestUpgradeableWrapperTraderV2";
    ITestAsyncProtocol public immutable TEST_ASYNC_PROTOCOL;

    // ============ Constructor ============

    constructor(address _testAsyncProtocol, address _weth) AsyncIsolationModeTraderBase(_weth) {
        TEST_ASYNC_PROTOCOL = ITestAsyncProtocol(_testAsyncProtocol);
    }

    function initialize(
        address _vaultFactory,
        address _handlerRegistry,
        address _dolomiteMargin
    ) external {
        _initializeWrapperTrader(_vaultFactory, _handlerRegistry, _dolomiteMargin);
    }

    // ===================== Functions =====================

    function initiateCancelDeposit(bytes32 _key) external {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        if (msg.sender == depositInfo.vault || isHandler(msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == depositInfo.vault || isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        TEST_ASYNC_PROTOCOL.cancelDeposit(_key);
    }

    function isValidInputToken(address _token) public override view returns (bool) {
        return _token != address(WETH);
    }

    function _createDepositWithExternalProtocol(
        address _vault,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) internal override returns (bytes32) {
        IERC20(_inputToken).approve(address(TEST_ASYNC_PROTOCOL), _inputAmount);
        bytes32 key = TEST_ASYNC_PROTOCOL.createDeposit(_inputToken, _inputAmount);
        return key;
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256)
    {
        return _desiredInputAmount;
    }

    // ============ Callbacks ============

    function afterDepositExecution(
        bytes32 _key,
        ITestAsyncProtocol.Deposit memory _deposit
    )
    external
    onlyHandler(msg.sender) {
        _executeDepositExecution(_key, _deposit.amount, _deposit.minAmount);
    }

    function afterDepositCancellation(
        bytes32 _key,
        ITestAsyncProtocol.Deposit memory /* _deposit */
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        depositInfo.isRetryable = true;
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _key, depositInfo);

        _executeDepositCancellation(depositInfo);
    }

    function afterWithdrawalExecution(bytes32 _key, ITestAsyncProtocol.Withdrawal memory _withdrawal) external {}
    function afterWithdrawalCancellation(bytes32 _key, ITestAsyncProtocol.Withdrawal memory _withdrawal) external {}
}
