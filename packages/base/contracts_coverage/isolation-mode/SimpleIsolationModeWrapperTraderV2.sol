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

import { IsolationModeWrapperTraderV2 } from "./abstract/IsolationModeWrapperTraderV2.sol";


/**
 * @title   SimpleIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping an underlying token into dToken. Upon settlement, the underlying token is sent to the
 *          user's vault and dToken is minted to `DolomiteMargin`.
 */
contract SimpleIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {

    // ============ Constants ============

    bytes32 private constant _FILE = "SimpleIsolationModeWrapperV2";

    // ============ Constructor ============

    constructor(
        address _dToken,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeWrapperTraderV2(
        _dToken,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ============ External Functions ============

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == VAULT_FACTORY.UNDERLYING_TOKEN();
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        uint256,
        address,
        uint256 _inputAmount,
        bytes memory
    )
        internal
        pure
        override
        returns (uint256)
    {
        return _inputAmount;
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
}
