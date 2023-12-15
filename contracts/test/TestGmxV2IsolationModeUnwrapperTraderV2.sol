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

import { GmxV2IsolationModeUnwrapperTraderV2 } from "../external/gmxV2/GmxV2IsolationModeUnwrapperTraderV2.sol";
import { SafeDelegateCallLib } from "../external/lib/SafeDelegateCallLib.sol";


/**
 * @title   TestGmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeUnwrapperTraderV2 is GmxV2IsolationModeUnwrapperTraderV2 {
    using SafeDelegateCallLib for address;

    constructor(address _weth) GmxV2IsolationModeUnwrapperTraderV2(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function vaultCreateWithdrawalInfo(
        bytes32 _key,
        address _vault,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) external {
        _vaultCreateWithdrawalInfo(
            _key,
            _vault,
            _accountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }
}
