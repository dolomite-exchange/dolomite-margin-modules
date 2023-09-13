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
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxV2IsolationModeTraderBase } from "./GmxV2IsolationModeTraderBase.sol";
import { GmxWithdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxWithdrawalCallbackReceiver } from "../interfaces/gmx/IGmxWithdrawalCallbackReceiver.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { UpgradeableIsolationModeUnwrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeUnwrapperTrader.sol";


/**
 * @title   GmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GM (via withdrawing from GMX)
 */
contract GmxV2IsolationModeUnwrapperTraderV2 is
    UpgradeableIsolationModeUnwrapperTrader,
    GmxV2IsolationModeTraderBase,
    IGmxV2IsolationModeUnwrapperTraderV2,
    IGmxWithdrawalCallbackReceiver
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeUnwrapperV2";

    receive() external payable {} // solhint-disable-line -no-empty-blocks

    // ============ Initializer ============

    function initialize(
        address _gmxRegistryV2,
        address _weth,
        address _dGM,
        address _dolomiteMargin
    ) external initializer {
        _initializeUnwrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth);
        _setAddress(_GMX_REGISTRY_V2_SLOT, _gmxRegistryV2);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    // @audit Add some comment for guardian to check that we test it properly
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
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).longToken();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).shortToken();
        return _outputToken == longToken || _outputToken == shortToken;
    }

    function afterWithdrawalExecution(bytes32 key, GmxWithdrawal.Props memory withdrawal, GmxEventUtils.EventLogData memory eventData) external {
        // Burn the dolomite tokens

        // Create the rest of the actions
    }

    function afterWithdrawalCancellation(bytes32 key, GmxWithdrawal.Props memory withdrawal, GmxEventUtils.EventLogData memory eventData) external {

    }

    function cancelWithdrawal(bytes32 _key) external {
        GMX_REGISTRY_V2().gmxExchangeRouter().cancelWithdrawal(_key);
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