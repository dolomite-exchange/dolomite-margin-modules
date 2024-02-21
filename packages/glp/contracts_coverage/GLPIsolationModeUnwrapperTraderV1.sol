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

import { IsolationModeUnwrapperTraderV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV1.sol"; // solhint-disable-line max-line-length
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GLPMathLib } from "./GLPMathLib.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";


/**
 * @title   GLPIsolationModeUnwrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GLP (via burning via the GLPRewardsRouter) into USDC. Upon settlement, the burned GLP is
 *          sent from the user's vault to this contract and dfsGLP is burned from `DolomiteMargin`.
 */
contract GLPIsolationModeUnwrapperTraderV1 is IsolationModeUnwrapperTraderV1 {
    using GLPMathLib for IGmxVault;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPIsolationModeUnwrapperV1";

    // ============ Immutable State Variables ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _dfsGlp,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV1(
        _dfsGlp,
        _dolomiteMargin
    ) {
        USDC = _usdc;
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);

        USDC_MARKET_ID = IDolomiteMargin(_dolomiteMargin).getMarketIdByTokenAddress(_usdc);
    }

    // ============================================
    // ============ External Functions ============
    // ============================================

    function outputMarketId() public override view returns (uint256) {
        return USDC_MARKET_ID;
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        if (_inputToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == USDC,
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, _desiredInputAmount);

        return GMX_REGISTRY.gmxVault().getGlpRedemptionAmount(_outputToken, usdgAmount);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256 _minOutputAmount,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        if (_outputToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == USDC,
            _FILE,
            "Invalid output token",
            _outputToken
        );

        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _outputToken,
            /* _glpAmount = */ _inputAmount,
            _minOutputAmount,
            /* _receiver = */ address(this)
        );

        return amountOut;
    }
}
