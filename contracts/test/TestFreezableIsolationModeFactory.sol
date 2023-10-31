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

import { TestIsolationModeFactory } from "./TestIsolationModeFactory.sol";
import { MinimalERC20 } from "../external/general/MinimalERC20.sol";
import { FreezableIsolationModeVaultFactory } from "../external/proxies/abstract/FreezableIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestFreezableIsolationModeFactory
 * @author  Dolomite
 *
 * @notice  This contract is used to test the FreezableIsolationModeVaultFactory contract.
 */
contract TestFreezableIsolationModeVaultFactory is TestIsolationModeFactory, FreezableIsolationModeVaultFactory {

    constructor(
        uint256 _executionFee,
        address _handlerRegistry,
        address _dolomiteRegistry,
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    TestIsolationModeFactory(
        _dolomiteRegistry,
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    )
    FreezableIsolationModeVaultFactory(
        _executionFee,
        _handlerRegistry
    )
    { /* solhint-disable-line no-empty-blocks */ }

    function _spendAllowance(
        address _owner,
        address _spender,
        uint256 _amount
    ) internal override (TestIsolationModeFactory, MinimalERC20) {
        TestIsolationModeFactory._spendAllowance(_owner, _spender, _amount);
    }
}
