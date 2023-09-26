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

import { GmxV2IsolationModeTokenVaultV1 } from "../external/gmxV2/GmxV2IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IGenericTraderProxyV1 } from "../external/interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestGmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeTokenVaultV1 is GmxV2IsolationModeTokenVaultV1 {

    // ============ Enums ============

    enum ReversionType {
        None,
        Revert,
        Require
    }

    // ============ Constants ============

    bytes32 private constant _FILE = "TestGmxV2IsolationModeVaultV1";
    bytes32 private constant _REVERSION_TYPE = bytes32(uint256(keccak256("eip1967.proxy.reversionType")) - 1);

    // ======== Constructor =========

    constructor(address _weth) GmxV2IsolationModeTokenVaultV1(_weth) { /* solhint-disable-line no-empty-blocks */ }

    // ============ Functions ============

    function setReversionType(ReversionType _reversionType) external {
        _setUint256(_REVERSION_TYPE, uint256(_reversionType));
    }

    function callInitiateUnwrappingAndTriggerReentrancy(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minLongTokenAmount,
        uint256 _minShortTokenAmount
    ) external payable nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.initiateUnwrapping.selector,
                _tradeAccountNumber,
                _inputAmount,
                _outputToken,
                _minLongTokenAmount,
                _minShortTokenAmount
            )
        );
        if (!isSuccessful) {
            if (result.length < 68) {
                revert("No reversion message!");
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    result := add(result, 0x04) // Slice the sighash.
                }
            }
            (string memory errorMessage) = abi.decode(result, (string));
            revert(errorMessage);
        }
    }

    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    virtual
    override {
        super._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );

        // Revert after so we can consume the gas and emulate real conditions as best as we can
        ReversionType reversionType = ReversionType(_getUint256(_REVERSION_TYPE));
        if (reversionType == ReversionType.Revert) {
            assert(false);
        } else if (reversionType == ReversionType.Require) {
            require(false, "Reverting");
        } else {
            assert(reversionType == ReversionType.None);
        }
    }
}
