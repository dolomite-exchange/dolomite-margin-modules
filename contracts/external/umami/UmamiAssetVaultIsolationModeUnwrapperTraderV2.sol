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
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   UmamiAssetVaultIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping Umami Delta Neutral Asset Vaults (via redeeming shares for the underlying token).
 *          During settlement, the redeemed vault token is sent from the user's Isolation Mode vault to this contract to
 *          process the unwrapping.
 */
contract UmamiAssetVaultIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "UmamiAssetVaultUnwrapperV2";

    // ============ Constructor ============

    constructor(
        address _dUmamiAssetVault,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeUnwrapperTraderV2(
        _dUmamiAssetVault,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).asset() == _outputToken;
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).redeem(
            _inputAmount,
            /* _receiver = */ address(this),
            /* _owner = */ address(this)
        );
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).previewRedeem(_desiredInputAmount);
    }
}
