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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { TestSimpleIsolationModeVaultFactory } from "./TestSimpleIsolationModeVaultFactory.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { SimpleIsolationModeTokenVaultV1 } from "../isolation-mode/SimpleIsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1 } from "../isolation-mode/abstract/IsolationModeTokenVaultV1.sol";


/**
 * @title   TestIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeTokenVaultV1 contract.
 */
contract TestIsolationModeTokenVaultV1 is SimpleIsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;

    function callDepositOtherTokenIntoDolomiteMarginForVaultOwner(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    ) external {
        IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId)).safeApprove(address(DOLOMITE_MARGIN()), _amountWei);

        IIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
            _toAccountNumber,
            _marketId,
            _amountWei
        );
    }

    function testReentrancy(bool _shouldReenter) public nonReentrant {
        if (_shouldReenter) {
            testReentrancy(false);
        }
    }

    function testReentrancyOnOtherFunction(bytes memory _data) public nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(_data);
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

    function dolomiteRegistry() public override(IsolationModeTokenVaultV1) view returns (IDolomiteRegistry) {
        return TestSimpleIsolationModeVaultFactory(VAULT_FACTORY()).dolomiteRegistry();
    }
}
