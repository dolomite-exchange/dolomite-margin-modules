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

import { PendleYtGLPMar2024IsolationModeTokenVaultV1 } from "../PendleYtGLPMar2024IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestPendleYtGLPMar2024IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestPendleYtGLPMar2024IsolationModeTokenVaultV1 is PendleYtGLPMar2024IsolationModeTokenVaultV1 {

    bytes32 private constant _FILE = "TestPendleYtGLPMar2024UserVaultV1";

    function callRedeemDueInterestAndRewardsTriggerReentrancy(
        bool _redeemInterest,
        bool _redeemRewards,
        bool[] memory _depositRewardsIntoDolomite,
        bool _depositInterestIntoDolomite
    ) external nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSignature(
                "redeemDueInterestAndRewards(bool,bool,bool[],bool)",
                _redeemInterest,
                _redeemRewards,
                _depositRewardsIntoDolomite,
                _depositInterestIntoDolomite
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
