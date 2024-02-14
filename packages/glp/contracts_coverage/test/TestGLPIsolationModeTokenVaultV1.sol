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

import { GLPIsolationModeTokenVaultV1 } from "../GLPIsolationModeTokenVaultV1.sol";


/**
 * @title   TestGLPIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGLPIsolationModeTokenVaultV1 is GLPIsolationModeTokenVaultV1 {

    bytes32 private constant _FILE = "TestGLPIsolationModeTokenVaultV1";

    function setApprovalForGmxForStaking(uint _amount) external {
        _approveGmxForStaking(gmx(), _amount);
    }

    function callHandleRewardsAndTriggerReentrancy(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite
    ) external nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSignature(
                "handleRewards(bool,bool,bool,bool,bool,bool,bool)",
                _shouldClaimGmx,
                _shouldStakeGmx,
                _shouldClaimEsGmx,
                _shouldStakeEsGmx,
                _shouldStakeMultiplierPoints,
                _shouldClaimWeth,
                _shouldDepositWethIntoDolomite
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

    function callHandleRewardsWithSpecificDepositAccountNumberAndTriggerReentrancy(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    ) external nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSignature(
                "handleRewardsWithSpecificDepositAccountNumber(bool,bool,bool,bool,bool,bool,bool,uint256)",
                _shouldClaimGmx,
                _shouldStakeGmx,
                _shouldClaimEsGmx,
                _shouldStakeEsGmx,
                _shouldStakeMultiplierPoints,
                _shouldClaimWeth,
                _shouldDepositWethIntoDolomite,
                _depositAccountNumberForWeth
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

    function callAcceptFullAccountTransferAndTriggerReentrancy(address _sender) external nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSignature("acceptFullAccountTransfer(address)", _sender)
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
