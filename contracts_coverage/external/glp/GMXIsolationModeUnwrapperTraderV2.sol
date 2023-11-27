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

import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   GMXIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping dGMX into any supported token. Upon settlement,
 *          the GMX is sent from the user's vault to this contract and dGMX is burned from `DolomiteMargin`.
 */
contract GMXIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {

    // ============ Constants ============

    bytes32 private constant _FILE = "GMXIsolationModeUnwrapperV2";

    // ============ Immutable State Variables ============

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _dGmx,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dGmx,
        _dolomiteMargin
    ) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(GMX_REGISTRY.gmx());
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
    override
    returns (uint256) {
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
    view
    returns (uint256) {
        return _desiredInputAmount;
    }
}
