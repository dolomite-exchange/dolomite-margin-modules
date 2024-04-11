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
import { OnlyDolomiteMarginForUpgradeable } from "../../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { IEventEmitterRegistry } from "../../interfaces/IEventEmitterRegistry.sol";
import { IHandlerRegistry } from "../../interfaces/IHandlerRegistry.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IAsyncIsolationModeTraderBase } from "../interfaces/IAsyncIsolationModeTraderBase.sol";


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

    // ===================================================
    // ==================== Immutable ====================
    // ===================================================

    IWETH public immutable override WETH; // solhint-disable-line var-name-mixedcase

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler(address _from) {
        _validateIsHandler(_from);
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
    }

    function ownerWithdrawETH(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = address(this).balance;
        WETH.deposit{value: bal}();
        WETH.safeTransfer(_receiver, bal);
        emit OwnerWithdrawETH(_receiver, bal);
    }

    function HANDLER_REGISTRY() public view virtual returns (IHandlerRegistry);

    function callbackGasLimit() public view returns (uint256) {
        return HANDLER_REGISTRY().callbackGasLimit();
    }

    function isHandler(address _handler) public view returns (bool) {
        return HANDLER_REGISTRY().isHandler(_handler);
    }

    // ========================= Internal Functions =========================

    function _eventEmitter() internal view returns (IEventEmitterRegistry) {
        return HANDLER_REGISTRY().dolomiteRegistry().eventEmitter();
    }

    function _validateIsHandler(address _from) internal view {
        if (isHandler(_from)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isHandler(_from),
            _FILE,
            "Only handler can call",
            _from
        );
    }

    function _validateIsRetryable(bool _isRetryable) internal pure {
        if (_isRetryable) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isRetryable,
            _FILE,
            "Conversion is not retryable"
        );
    }
}
