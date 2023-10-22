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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IHandlerRegistry } from "../interfaces/IHandlerRegistry.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { ValidationLib } from "../lib/ValidationLib.sol";


/**
 * @title   HandlerRegistry
 * @author  Dolomite
 *
 * @notice  Registry contract for storing ecosystem-related addresses
 */
abstract contract HandlerRegistry is
    IHandlerRegistry,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{

    // ===================== Constants =====================

    bytes32 private constant _FILE = "HandlerRegistry";
    bytes32 internal constant _CALLBACK_GAS_LIMIT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.callbackGasLimit")) - 1); // solhint-disable-line max-line-length
    bytes32 internal constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);

    // ===================== Functions =====================

    function ownerSetIsHandler(
        address _handler,
        bool _isTrusted
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsHandler(_handler, _isTrusted);
    }

    function ownerSetCallbackGasLimit(
        uint256 _callbackGasLimit
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCallbackGasLimit(_callbackGasLimit);
    }

    function callbackGasLimit() external view returns (uint256) {
        return _getUint256(_CALLBACK_GAS_LIMIT_SLOT);
    }

    function isHandler(address _handler) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        return _getUint256(slot) == 1;
    }

    // ===================== Internal Functions =====================

    function _ownerSetIsHandler(address _handler, bool _isTrusted) internal {
        bytes32 slot =  keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        _setUint256(slot, _isTrusted ? 1 : 0);
        emit HandlerSet(_handler, _isTrusted);
    }

    function _ownerSetCallbackGasLimit(uint256 _callbackGasLimit) internal {
        // We don't want to enforce a minimum. That way, we can disable callbacks (if needed) by setting this to 0.
        _setUint256(_CALLBACK_GAS_LIMIT_SLOT, _callbackGasLimit);
        emit CallbackGasLimitSet(_callbackGasLimit);
    }
}
