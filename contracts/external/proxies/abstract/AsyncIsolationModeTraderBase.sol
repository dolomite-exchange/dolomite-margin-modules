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
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IWETH } from "../../../protocol/interfaces/IWETH.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { IAsyncIsolationModeTraderBase } from "../../interfaces/IAsyncIsolationModeTraderBase.sol";
import { IEventEmitterRegistry } from "../../interfaces/IEventEmitter.sol";
import { IHandlerRegistry } from "../../interfaces/IHandlerRegistry.sol";


/**
 * @title   AsyncIsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Base class for wrappers and unwrappers that need to resolve mints and/or redeems asynchronously
 */
abstract contract AsyncIsolationModeTraderBase is
    IAsyncIsolationModeTraderBase,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{
    using SafeERC20 for IWETH;


    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "AsyncIsolationModeTraderBase";
    bytes32 private constant _HANDLER_REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlerRegistry")) - 1);

    // ===================================================
    // ==================== Immutable ====================
    // ===================================================

    IWETH public immutable override WETH; // solhint-disable-line var-name-mixedcase

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler(address _from) {
        Require.that(
            isHandler(_from),
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    // ===================================================
    // =================== Constructors ==================
    // ===================================================

    constructor(address _weth) {
        WETH = IWETH(_weth);
    }

    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
        // @audit - should we bother validating it comes from WETH or the router? We don't have much contract space
        //          to work with (we're up against the 24.5kb limit)
    }

    function ownerWithdrawETH(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = address(this).balance;
        WETH.deposit{value: bal}();
        WETH.safeTransfer(_receiver, bal);
        emit OwnerWithdrawETH(_receiver, bal);
    }

    function HANDLER_REGISTRY() public view returns (IHandlerRegistry) {
        return IHandlerRegistry(_getAddress(_HANDLER_REGISTRY_SLOT));
    }

    function callbackGasLimit() public view returns (uint256) {
        return HANDLER_REGISTRY().callbackGasLimit();
    }

    function isHandler(address _handler) public view returns (bool) {
        return HANDLER_REGISTRY().isHandler(_handler);
    }

    // ========================= Internal Functions =========================

    function _initializeAsyncTraderBase(
        address _registry
    ) internal initializer {
        _setAddress(_HANDLER_REGISTRY_SLOT, _registry);
    }

    function _eventEmitter() internal view returns (IEventEmitterRegistry) {
        return HANDLER_REGISTRY().dolomiteRegistry().eventEmitter();
    }

    function _validateIsRetryable(bool _isRetryable) internal pure {
        Require.that(
            _isRetryable,
            _FILE,
            "Conversion is not retryable"
        );
    }
}
