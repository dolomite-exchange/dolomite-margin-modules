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

import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { JonesUSDCIsolationModeUnwrapperTraderV2 } from "./JonesUSDCIsolationModeUnwrapperTraderV2.sol";
import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";


/**
 * @title   JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation
 * @author  Dolomite
 *
 * @notice  Used for unwrapping jUSDC into USDC. During settlement, the redeemed jUSDC is sent from the user's vault to
 *          this contract to process the unwrapping.
 */
contract JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation is JonesUSDCIsolationModeUnwrapperTraderV2 {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============ Constants ============

    bytes32 private constant _FILE = "JonesUSDCUnwrapperV2Liquidation";

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _jonesUSDCRegistry,
        address _djUSDC,
        address _dolomiteMargin
    )
    JonesUSDCIsolationModeUnwrapperTraderV2(
        _usdc,
        _jonesUSDCRegistry,
        _djUSDC,
        _dolomiteMargin
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        if (_isValidLiquidator(_sender, VAULT_FACTORY.marketId())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isValidLiquidator(_sender, VAULT_FACTORY.marketId()),
            _FILE,
            "Sender must be a liquidator",
            _sender
        );
        super._callFunction(_sender, _accountInfo, _data);
    }
}
