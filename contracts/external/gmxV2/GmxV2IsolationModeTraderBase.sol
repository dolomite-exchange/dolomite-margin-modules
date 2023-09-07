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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IGmxV2IsolationModeTraderBase } from "../interfaces/gmx/IGmxV2IsolationModeTraderBase.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";


/**
 * @title   GmxV2IsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Base class for GMX V2 Wrappers and Unwrappers
 */

abstract contract GmxV2IsolationModeTraderBase is OnlyDolomiteMargin, IGmxV2IsolationModeTraderBase {
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";
    bytes32 private constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);

    IWETH public immutable WETH;


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

    constructor(address _weth) {
        WETH = IWETH(_weth);
    }


    function ownerSetIsHandler(address _handler, bool _isTrusted) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsHandler(_handler, _isTrusted);
    }

    function isHandler(address _handler) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        return _getUint256(slot) == 1;
    }

    function ownerWithdrawETH(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = address(this).balance;
        WETH.deposit{value: bal}();
        WETH.safeTransfer(_receiver, bal);
        // TODO: emit event OwnerWithdrawETH(_receiver, bal);
    }

    // ========================= Internal Functions =========================

    function _ownerSetIsHandler(address _handler, bool _isTrusted) internal {
        bytes32 slot =  keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        _setUint256(slot, _isTrusted ? 1 : 0);
        // TODO: emit event OwnerSetIsHandler(_handler, _isTrusted);
    }
}
