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

import { UpgradeableAsyncIsolationModeUnwrapperTrader } from "../isolation-mode/abstract/UpgradeableAsyncIsolationModeUnwrapperTrader.sol";
import { AsyncIsolationModeTraderBase } from "../isolation-mode/abstract/AsyncIsolationModeTraderBase.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { AsyncIsolationModeUnwrapperTraderImpl } from "../isolation-mode/abstract/impl/AsyncIsolationModeUnwrapperTraderImpl.sol";
import { Require } from "../protocol/lib/Require.sol";
import { ITestAsyncProtocol } from "./ITestAsyncProtocol.sol";
import { ITestAsyncProtocolCallbackReceiver } from "./ITestAsyncProtocolCallbackReceiver.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol";


/**
 * @title   TestUpgradeableAsyncIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * @notice  Test contract for UpgradeableAsyncIsolationModeUnwrapperTrader
 */
contract TestUpgradeableAsyncIsolationModeUnwrapperTrader is
    UpgradeableAsyncIsolationModeUnwrapperTrader,
    ITestAsyncProtocolCallbackReceiver
{

    // ============ Modifiers ============

    modifier onlyWrapperCaller(address _from) {
        _validateIsWrapper(_from);
        _;
    }

    // ============ State variables ============

    bytes32 private constant _FILE = "TestUpgradeableUnwrapperTraderV2";
    ITestAsyncProtocol public immutable TEST_ASYNC_PROTOCOL;
    uint256 public revertFlag;

    // ============ Constructor ============

    constructor(address _testAsyncProtocol, address _weth) AsyncIsolationModeTraderBase(_weth) {
        TEST_ASYNC_PROTOCOL = ITestAsyncProtocol(_testAsyncProtocol);
    }

    function initialize(
        address _vaultFactory,
        address _handlerRegistry,
        address _dolomiteMargin
    ) external {
        _initializeUnwrapperTrader(_vaultFactory, _handlerRegistry, _dolomiteMargin);
    }

    // ============ Functions ============

    function vaultInitiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) external payable {
        IERC20(VAULT_FACTORY().UNDERLYING_TOKEN()).transferFrom(msg.sender, address(this), _inputAmount);
        bytes32 withdrawalKey = TEST_ASYNC_PROTOCOL.createWithdrawal(_outputToken, _inputAmount);

        _vaultCreateWithdrawalInfo(
            withdrawalKey,
            msg.sender,
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function handleCallbackFromWrapperBefore() external onlyWrapperCaller(msg.sender) {
        if (revertFlag == 1) {
            revert();
        }
        else if (revertFlag == 2) {
            revert("Revert message");
        }
        _handleCallbackBefore();
    }

    function handleCallbackFromWrapperAfter() external onlyWrapperCaller(msg.sender) {
        _handleCallbackAfter();
    }

    function initiateCancelWithdrawal(bytes32 _key) external {
        TEST_ASYNC_PROTOCOL.cancelWithdrawal(_key);
    }

    function setRevertFlag(uint256 _flag) external {
        revertFlag = _flag;
    }

    function getWithdrawalInfo(bytes32 _key) public view returns (WithdrawalInfo memory) {
        return _getWithdrawalSlot(_key);
    }


    function isValidOutputToken(
        address _outputToken
    )
    public
    view
    override(UpgradeableAsyncIsolationModeUnwrapperTrader)
    returns (bool) {
        return _outputToken != address(WETH);
    }

    function _executeWithdrawal(WithdrawalInfo memory _withdrawalInfo) internal override {
        _handleCallbackBefore();
        super._executeWithdrawal(_withdrawalInfo);
        _handleCallbackAfter();
    }

    function _validateIsBalanceSufficient(uint256 _inputAmount) internal override view {
        // solhint-disable-previous-line no-empty-blocks
        if (_inputAmount == 212) {
            super._validateIsBalanceSufficient(_inputAmount);
        }
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
    returns (uint256) {
        return _desiredInputAmount;
    }

    function _validateIsWrapper(address _from) internal view {
        Require.that(
            _from == address(_getWrapperTrader()),
            _FILE,
            "Caller can only be wrapper",
            _from
        );
    }

    // ===================== Callbacks =====================

    function afterWithdrawalExecution(bytes32 _key, ITestAsyncProtocol.Withdrawal memory _withdrawal) external {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        _validateWithdrawalExists(withdrawalInfo);

        withdrawalInfo.outputAmount = _withdrawal.amountOut;
        withdrawalInfo.isRetryable = true;
        AsyncIsolationModeUnwrapperTraderImpl.setWithdrawalInfo(_getStorageSlot(), _key, withdrawalInfo);

        _executeWithdrawal(withdrawalInfo);
    }

    function afterWithdrawalCancellation(bytes32 _key, ITestAsyncProtocol.Withdrawal memory _withdrawal) external {
        _executeWithdrawalCancellation(_key);
    }

    function afterDepositExecution(bytes32 _key, ITestAsyncProtocol.Deposit memory _deposit) external {}
    function afterDepositCancellation(bytes32 _key, ITestAsyncProtocol.Deposit memory _deposit) external {}

    // ===================== Test functions =====================

    function testValidateVaultExists(IIsolationModeVaultFactory _factory, address _vault) external view {
        _validateVaultExists(_factory, _vault);
    }

    function testValidateIsBalanceSufficient(uint256 _inputAmount) external view {
        _validateIsBalanceSufficient(_inputAmount);
    }

    function getWrapperTrader() external view returns (IUpgradeableAsyncIsolationModeWrapperTrader) {
        return _getWrapperTrader();
    }

    function callExecuteWithdrawalForRetryAndTriggerReentrancy(bytes32 _key) external nonReentrant {
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.executeWithdrawalForRetry.selector,
                _key
            )
        );
        if (!isSuccessful) {
            if (result.length < 68) {
                revert("No reversion message!");
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    result := add(result, 0x04) // Slice the sighash.
                }
            }
            (string memory errorMessage) = abi.decode(result, (string));
            revert(errorMessage);
        }
    }

}
