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

import { IsolationModeUnwrapperTraderV2 } from "./abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   SimpleIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping dTokens into underlying tokens. Upon settlement, the underlying is sent from the user's
 *          vault to this contract and dToken is burned from `DolomiteMargin`.
 */
contract SimpleIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {

    // ============ Constants ============

    bytes32 private constant _FILE = "SimpleIsolationModeUnwrapperV2";

    // ============ Constructor ============

    constructor(
        address _vaultFactory,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeUnwrapperTraderV2(
        _vaultFactory,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == VAULT_FACTORY.UNDERLYING_TOKEN();
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
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
