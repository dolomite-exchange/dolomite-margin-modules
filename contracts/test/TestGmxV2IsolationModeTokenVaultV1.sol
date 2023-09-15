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

import { GmxV2IsolationModeTokenVaultV1 } from "../external/gmxV2/GmxV2IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IGenericTraderProxyV1 } from "../external/interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../external/interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestGmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeTokenVaultV1 is GmxV2IsolationModeTokenVaultV1 {

    bytes32 private constant _FILE = "TestGmxV2IsolationModeVaultV1";

    constructor(address _weth) GmxV2IsolationModeTokenVaultV1(_weth) {}

    function callInitiateWrappingAndTriggerReentrancy(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) external payable nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.initiateWrapping.selector,
                _tradeAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
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

    function callInitiateUnwrappingAndTriggerReentrancy(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external payable nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.initiateUnwrapping.selector,
                _tradeAccountNumber,
                _inputAmount,
                _outputToken,
                _minOutputAmount
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
