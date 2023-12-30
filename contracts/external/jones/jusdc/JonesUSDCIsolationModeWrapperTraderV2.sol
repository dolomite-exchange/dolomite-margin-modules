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
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IsolationModeWrapperTraderV2 } from "../../proxies/abstract/IsolationModeWrapperTraderV2.sol";


/**
 * @title   JonesUSDCIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping jUSDC into USDC. During settlement, the redeemed jUSDC is sent from the user's vault to
 *          this contract to process the unwrapping.
 */
contract JonesUSDCIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {

    // ============ Constants ============

    bytes32 private constant _FILE = "JonesUSDCWrapperV2";

    // ============ Immutable State Variables ============

    IERC20 public immutable USDC; // solhint-disable-line var-name-mixedcase
    IJonesUSDCRegistry public immutable JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _jonesVaultRegistry,
        address _djUSDC,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV2(
        _djUSDC,
        _dolomiteMargin,
        address(IJonesUSDCRegistry(_jonesVaultRegistry).dolomiteRegistry())
    ) {
        USDC = IERC20(_usdc);
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesVaultRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == address(USDC);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
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
        USDC.approve(address(JONES_USDC_REGISTRY.glpAdapter()), _inputAmount);
        return JONES_USDC_REGISTRY.glpAdapter().depositStable(_inputAmount, /* _compound = */ true);
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
        uint256 receiptTokenAmount = JONES_USDC_REGISTRY.usdcReceiptToken().previewDeposit(_desiredInputAmount);
        return JONES_USDC_REGISTRY.jUSDC().previewDeposit(receiptTokenAmount);
    }
}
