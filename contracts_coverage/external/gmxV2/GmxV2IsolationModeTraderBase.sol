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
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeTraderBase } from "../interfaces/gmx/IGmxV2IsolationModeTraderBase.sol";


/**
 * @title   GmxV2IsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Base class for GMX V2 Wrappers and Unwrappers
 */
abstract contract GmxV2IsolationModeTraderBase is
    IGmxV2IsolationModeTraderBase,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeTraderBase";
    uint256 internal constant _SLIPPAGE_BASE = 10_000;

    bytes32 internal constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);
    bytes32 internal constant _WETH_SLOT = bytes32(uint256(keccak256("eip1967.proxy.weth")) - 1);
    bytes32 internal constant _CALLBACK_GAS_LIMIT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.callbackGasLimit")) - 1); // solhint-disable-line max-line-length
    bytes32 internal constant _SLIPPAGE_MINIMUM_SLOT = bytes32(uint256(keccak256("eip1967.proxy.slippageMinimum")) - 1);
    bytes32 internal constant _GMX_REGISTRY_V2_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxRegistryV2")) - 1);


    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler(address _from) {
        if (isHandler(_from)) { /* FOR COVERAGE TESTING */ }
        Require.that(isHandler(_from),
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    function ownerSetIsHandler(address _handler, bool _isTrusted) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsHandler(_handler, _isTrusted);
    }

    function ownerWithdrawETH(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = address(this).balance;
        WETH().deposit{value: bal}();
        WETH().safeTransfer(_receiver, bal);
        emit OwnerWithdrawETH(_receiver, bal);
    }

    function ownerSetCallbackGasLimit(uint256 _callbackGasLimit) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCallbackGasLimit(_callbackGasLimit);
    }

    function ownerSetSlippageMinimum(uint256 _slippageMinimum) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSlippageMinimum(_slippageMinimum);
    }

    function isHandler(address _handler) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        return _getUint256(slot) == 1;
    }

    function WETH() public view returns (IWETH) {
        return IWETH(_getAddress(_WETH_SLOT));
    }

    function GMX_REGISTRY_V2() public view returns (IGmxRegistryV2) {
        return IGmxRegistryV2(_getAddress(_GMX_REGISTRY_V2_SLOT));
    }

    function slippageMinimum() public view returns (uint256) {
        return _getUint256(_SLIPPAGE_MINIMUM_SLOT);
    }

    function callbackGasLimit() public view returns (uint256) {
        return _getUint256(_CALLBACK_GAS_LIMIT_SLOT);
    }

    // ========================= Internal Functions =========================

    function _initializeTraderBase(address _gmxRegistryV2, address _weth) internal initializer {
        _setAddress(_WETH_SLOT, _weth);
        _setAddress(_GMX_REGISTRY_V2_SLOT, _gmxRegistryV2);
    }

    function _ownerSetIsHandler(address _handler, bool _isTrusted) internal {
        bytes32 slot =  keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        _setUint256(slot, _isTrusted ? 1 : 0);
        emit OwnerSetIsHandler(_handler, _isTrusted);
    }

    function _ownerSetCallbackGasLimit(uint256 _callbackGasLimit) internal {
        _setUint256(_CALLBACK_GAS_LIMIT_SLOT, _callbackGasLimit);
    }

    function _ownerSetSlippageMinimum(uint256 _slippageMinimum) internal {
        if (_slippageMinimum < _SLIPPAGE_BASE && _slippageMinimum > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_slippageMinimum < _SLIPPAGE_BASE && _slippageMinimum > 0,
            _FILE,
            "Invalid slippageMinimum"
        );
        _setUint256(_SLIPPAGE_MINIMUM_SLOT, _slippageMinimum);
    }

}
