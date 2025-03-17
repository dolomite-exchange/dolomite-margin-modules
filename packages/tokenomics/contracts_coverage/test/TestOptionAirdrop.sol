// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { InternalSafeDelegateCallLib } from "@dolomite-exchange/modules-base/contracts/lib/InternalSafeDelegateCallLib.sol"; // solhint-disable-line max-line-length
import { OptionAirdrop } from "../OptionAirdrop.sol";


/**
 * @title   TestOptionAirdrop
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestOptionAirdrop is OptionAirdrop {

    constructor(
        address _dolo,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OptionAirdrop(
        _dolo,
        _dolomiteRegistry,
        _dolomiteMargin
    ) {} // solhint-disable-line

    function callClaimAndTriggerReentrancy(
        bytes32[] calldata _proof,
        uint256 _allocatedAmount,
        uint256 _claimAmount,
        uint256 _marketId,
        uint256 _fromAccountNumber
    ) external nonReentrant {
        InternalSafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.claim.selector,
                _proof,
                _allocatedAmount,
                _claimAmount,
                _marketId,
                _fromAccountNumber
            )
        );
    }
}
