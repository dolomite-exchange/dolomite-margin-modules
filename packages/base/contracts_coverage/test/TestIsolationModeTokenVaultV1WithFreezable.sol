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

import { TestSimpleIsolationModeVaultFactory } from "./TestSimpleIsolationModeVaultFactory.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IFreezableIsolationModeVaultFactory } from "../isolation-mode/interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestIsolationModeTokenVaultV1WithFreezable
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeTokenVaultV1WithFreezable contract.
 */
contract TestIsolationModeTokenVaultV1WithFreezable is IsolationModeTokenVaultV1WithFreezable {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "TestFreezableIsolationModeVault";

    // solhint-disable-next-line no-empty-blocks
    constructor(address _weth) IsolationModeTokenVaultV1WithFreezable(_weth) {}

    function dolomiteRegistry() public override view returns (IDolomiteRegistry) {
        return TestSimpleIsolationModeVaultFactory(VAULT_FACTORY()).dolomiteRegistry();
    }

    function testRequireVaultAccountNotFrozen(uint256 _accountNumber) external view requireVaultAccountNotFrozen(_accountNumber) {}

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        if (msg.value == IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).executionFee()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.value == IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).executionFee(),
            _FILE,
            'Invalid execution fee'
        );
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(_toAccountNumber, msg.value);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 /* _minOutputAmount */,
        bool _isLiquidation,
        bytes calldata /* _extraData */
    ) internal override {
        if (_isLiquidation) {
            IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).setVaultAccountPendingAmountForFrozenStatus(
                /* _vault = */ address(this),
                _tradeAccountNumber,
                IFreezableIsolationModeVaultFactory.FreezeType.Withdrawal,
                /* _amountDeltaWei = */ IDolomiteStructs.Wei({
                    sign: true,
                    value: _inputAmount
                }),
                _outputToken
            );
        }
    }

    function callInitiateUnwrappingAndTriggerReentrancy(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bytes calldata _extraData
    ) external nonReentrant {
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.initiateUnwrapping.selector,
                _tradeAccountNumber,
                _inputAmount,
                _outputToken,
                _minOutputAmount,
                _extraData
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

    function callInitiateUnwrappingForLiquidationAndTriggerReentrancy(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bytes calldata _extraData
    ) external nonReentrant {
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.initiateUnwrappingForLiquidation.selector,
                _tradeAccountNumber,
                _inputAmount,
                _outputToken,
                _minOutputAmount,
                _extraData
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

    function _checkMsgValue() internal override view {}
}
