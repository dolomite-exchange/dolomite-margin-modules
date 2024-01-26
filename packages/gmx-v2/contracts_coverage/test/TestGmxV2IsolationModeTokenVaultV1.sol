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

import { GmxV2IsolationModeTokenVaultV1 } from "../GmxV2IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IGenericTraderProxyV1 } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderProxyV1.sol";
import { SafeDelegateCallLib } from "@dolomite-exchange/modules-base/contracts/lib/SafeDelegateCallLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestGmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeTokenVaultV1 is GmxV2IsolationModeTokenVaultV1 {
    using SafeDelegateCallLib for address;

    // ============ Enums ============

    enum ReversionType {
        None,
        Error,
        Require
    }

    // ============ Constants ============

    bytes32 private constant _REVERSION_TYPE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.reversionType")) - 1);

    // ============ Errors ============

    error RevertError(string message);

    // ======== Constructor =========

    constructor(address _weth) GmxV2IsolationModeTokenVaultV1(_weth) { /* solhint-disable-line no-empty-blocks */ }

    // ============ Functions ============

    function setReversionType(ReversionType _reversionType) external {
        _setUint256(_REVERSION_TYPE_SLOT, uint256(_reversionType));
    }

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }

    function initiateUnwrappingWithLiquidationTrue(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bytes calldata _extraData
    ) external payable {
        _initiateUnwrapping(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            /* isLiquidation */ true,
            _extraData
        );
    }

    function reversionType() public view returns (ReversionType) {
        return ReversionType(_getUint256(_REVERSION_TYPE_SLOT));
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
    internal
    virtual
    override {
        super._swapExactInputForOutput(
            _params
        );

        // Error after so we can consume the gas and emulate real conditions as best as we can
        ReversionType _reversionType = reversionType();
        if (_reversionType == ReversionType.Error) {
            revert RevertError("Reverting");
        } else if (_reversionType == ReversionType.Require) {
            require(false, "Reverting");
        } else {
            assert(_reversionType == ReversionType.None);
        }
    }
}
