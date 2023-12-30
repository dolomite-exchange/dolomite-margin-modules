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
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { IsolationModeWrapperTraderV2 } from "../proxies/abstract/IsolationModeWrapperTraderV2.sol";


/**
 * @title   UmamiAssetVaultIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping Umami Delta Neutral Asset Vaults (via depositing assets of the underlying token).
 *          During settlement, the minted vault token is sent to the user's Isolation Mode vault from this contract to
 *          finalize the wrapping.
 */
contract UmamiAssetVaultIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    // ============ Constants ============

    bytes32 private constant _FILE = "UmamiAssetVaultWrapperV2";

    // ============ Constructor ============

    constructor(
        address _dUmamiAssetVault,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeWrapperTraderV2(
        _dUmamiAssetVault,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).asset() == _inputToken;
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address _outputTokenUnderlying,
        uint256,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), _outputTokenUnderlying, _inputAmount);
        return IERC4626(_outputTokenUnderlying).deposit(
            _inputAmount,
            /* _receiver = */ address(this)
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
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).previewDeposit(_desiredInputAmount);
    }
}
