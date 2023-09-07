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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxWithdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxWithdrawalCallbackReceiver } from "../interfaces/gmx/IGmxWithdrawalCallbackReceiver.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   GmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GM (via withdrawing from GMX)
 */
contract GmxV2IsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2, IGmxWithdrawalCallbackReceiver {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeUnwrapperV2";

    // ============ Constructor ============

    IGmxRegistryV2 public immutable GMX_REGISTRY_V2; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gmxRegistryV2,
        address _dytGlp,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dytGlp,
        _dolomiteMargin
    ) {
        GMX_REGISTRY_V2 = IGmxRegistryV2(_gmxRegistryV2);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function createActionsForUnwrapping(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address _solidAccountOwner,
        address _liquidAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    virtual
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        // Freeze vault

        // call GMX to initiate withdrawal
    }

    function isValidOutputToken(address _outputToken) public view override returns (bool) {
        // only return true if _outputToken is one of underlying tokens
        return true;
    }

    function afterWithdrawalExecution(bytes32 key, GmxWithdrawal.Props memory withdrawal, GmxEventUtils.EventLogData memory eventData) external {
        // Burn the dolomite tokens

        // Create the rest of the actions
    }

    function afterWithdrawalCancellation(bytes32 key, GmxWithdrawal.Props memory withdrawal, GmxEventUtils.EventLogData memory eventData) external {

    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256 _minOutputAmount,
        address,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        // withdraw from

    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
