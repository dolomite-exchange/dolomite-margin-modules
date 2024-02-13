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
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IHandlerRegistry } from "../interfaces/IHandlerRegistry.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable max-line-length
import { ValidationLib } from "../lib/ValidationLib.sol";
import { Require } from "../protocol/lib/Require.sol";


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
    // solhint-disable max-line-length
    bytes32 internal constant _CALLBACK_GAS_LIMIT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.callbackGasLimit")) - 1);
    bytes32 internal constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);
    bytes32 internal constant _UNWRAPPER_BY_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unwrapperByToken")) - 1);
    bytes32 internal constant _WRAPPER_BY_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wrapperByToken")) - 1);
    // solhint-enable max-line-length

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

    function ownerSetUnwrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeUnwrapperTrader _unwrapperTrader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUnwrapperByToken(_factoryToken, _unwrapperTrader);
    }

    function ownerSetWrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeWrapperTrader _wrapperTrader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetWrapperByToken(_factoryToken, _wrapperTrader);
    }

    function callbackGasLimit() external view returns (uint256) {
        return _getUint256(_CALLBACK_GAS_LIMIT_SLOT);
    }

    function getUnwrapperByToken(
        IIsolationModeVaultFactory _factoryToken
    ) external view returns (IUpgradeableAsyncIsolationModeUnwrapperTrader) {
        bytes32 slot = keccak256(abi.encodePacked(_UNWRAPPER_BY_TOKEN_SLOT, address(_factoryToken)));
        return IUpgradeableAsyncIsolationModeUnwrapperTrader(_getAddress(slot));
    }

    function getWrapperByToken(
        IIsolationModeVaultFactory _factoryToken
    ) external view returns (IUpgradeableAsyncIsolationModeWrapperTrader) {
        bytes32 slot = keccak256(abi.encodePacked(_WRAPPER_BY_TOKEN_SLOT, address(_factoryToken)));
        return IUpgradeableAsyncIsolationModeWrapperTrader(_getAddress(slot));
    }

    function isHandler(address _handler) public virtual view returns (bool) {
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

    function _ownerSetUnwrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeUnwrapperTrader _unwrapperTrader
    )
    internal {
        _validateFactoryToken(_factoryToken);
        bytes memory result = ValidationLib.callAndCheckSuccess(
            address(_unwrapperTrader),
            _unwrapperTrader.VAULT_FACTORY.selector,
            /* _data = */ bytes("")
        );
        Require.that(
            abi.decode(result, (address)) == address(_factoryToken),
            _FILE,
            "Invalid unwrapper trader"
        );
        bytes32 slot = keccak256(abi.encodePacked(_UNWRAPPER_BY_TOKEN_SLOT, address(_factoryToken)));
        _setAddress(slot, address(_unwrapperTrader));
        emit UnwrapperTraderSet(address(_factoryToken), address(_unwrapperTrader));
    }

    function _ownerSetWrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeWrapperTrader _wrapperTrader
    )
    internal {
        _validateFactoryToken(_factoryToken);
        bytes memory result = ValidationLib.callAndCheckSuccess(
            address(_wrapperTrader),
            _wrapperTrader.VAULT_FACTORY.selector,
            /* _data = */ bytes("")
        );
        Require.that(
            abi.decode(result, (address)) == address(_factoryToken),
            _FILE,
            "Invalid wrapper trader"
        );

        bytes32 slot = keccak256(abi.encodePacked(_WRAPPER_BY_TOKEN_SLOT, address(_factoryToken)));
        _setAddress(slot, address(_wrapperTrader));
        emit WrapperTraderSet(address(_factoryToken), address(_wrapperTrader));
    }

    function _validateFactoryToken(IIsolationModeVaultFactory _factoryToken) private view {
        bytes memory result = ValidationLib.callAndCheckSuccess(
            address(_factoryToken),
            _factoryToken.marketId.selector,
            /* _data = */ bytes("")
        );
        Require.that(
            abi.decode(result, (uint256)) != 0,
            _FILE,
            "Invalid factory token"
        );
    }
}
