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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";


/**
 * @title   GLPMathLib
 * @author  Dolomite
 *
 * @notice  A library contract that contains helper functions for common math that GLP code needs to perform.
 */
library GLPMathLib {

    // ===========================================================
    // ======================== Constants ========================
    // ===========================================================

    bytes32 private constant _FILE = "GLPMathLib";

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant PRICE_PRECISION = 10 ** 30;

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    function getGlpMintAmount(
        IGmxRegistryV1 _gmxRegistry,
        uint256 _usdgAmount
    ) internal view returns (uint256 glpAmount) {
        // This code is taken from glpManager#_addLiquidity (returns GLP amount). The contract address copied is:
        // https://arbiscan.io/address/0x3963ffc9dff443c2a94f21b129d429891e32ec18#code
        uint256 aumInUsdg = _gmxRegistry.glpManager().getAumInUsdg(true);
        uint256 glpSupply = _gmxRegistry.glp().totalSupply();

        glpAmount = aumInUsdg == 0 || glpSupply == 0
            ? _usdgAmount
            : _usdgAmount * glpSupply / aumInUsdg;
    }

    function getUsdgAmountForBuy(
        IGmxVault _gmxVault,
        address _inputToken,
        uint256 _inputAmount
    ) internal view returns (uint256 usdgAmount) {
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Input amount must be gt than 0"
        );

        // This code is taken from gmxVault#buyUSDG (returns the usdgAmount). The contract address copied is:
        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        uint256 price = _gmxVault.getMinPrice(_inputToken);
        address usdg = _gmxVault.usdg();
        uint256 rawAmount = _gmxVault.adjustForDecimals(
            _inputAmount * price / PRICE_PRECISION,
            _inputToken,
            usdg
        );

        uint256 feeBasisPoints = _gmxVault.getFeeBasisPoints(
            _inputToken,
            rawAmount,
            _gmxVault.mintBurnFeeBasisPoints(),
            _gmxVault.taxBasisPoints(),
            /* _increment */ true
        );
        uint256 inputAmountAfterFees = applyFeesToAmount(_inputAmount, feeBasisPoints);
        usdgAmount = _gmxVault.adjustForDecimals(
            inputAmountAfterFees * price / PRICE_PRECISION,
            _inputToken,
            usdg
        );
    }

    function getUsdgAmountForSell(
        IGmxRegistryV1 _gmxRegistry,
        uint256 _glpAmount
    ) internal view returns (uint256 usdgAmount) {
        // This code is taken from GlpManager#_removeLiquidity (returns usdgAmount). The contract address copied is:
        // https://arbiscan.io/address/0x3963ffc9dff443c2a94f21b129d429891e32ec18#code
        uint256 aumInUsdg = _gmxRegistry.glpManager().getAumInUsdg(false);
        uint256 glpSupply = _gmxRegistry.glp().totalSupply();
        /*assert(glpSupply > 0);*/ // GLP supply is always > 0 here if a user wants to sell it;
        usdgAmount = _glpAmount * aumInUsdg / glpSupply;
    }

    function getGlpRedemptionAmount(
        IGmxVault _gmxVault,
        address _outputToken,
        uint256 _usdgAmount
    ) internal view returns (uint256 outputTokenAmount) {
        // This code is taken from gmxVault#sellUSDG (returns outputTokenAmount). The contract address copied is:
        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        uint256 redemptionAmount = _gmxVault.getRedemptionAmount(_outputToken, _usdgAmount);

        uint256 feeBasisPoints = _gmxVault.getFeeBasisPoints(
            _outputToken,
            _usdgAmount,
            _gmxVault.mintBurnFeeBasisPoints(),
            _gmxVault.taxBasisPoints(),
            /* _increment = */ false
        );
        outputTokenAmount = applyFeesToAmount(redemptionAmount, feeBasisPoints);
    }

    function basisPointsDivisor() internal pure returns (uint256) {
        return BASIS_POINTS_DIVISOR;
    }

    function pricePrecision() internal pure returns (uint256) {
        return PRICE_PRECISION;
    }

    function applyFeesToAmount(
        uint256 _amount,
        uint256 _feeBasisPoints
    ) internal pure returns (uint256) {
        // this code is taken from GMX in the `_collectSwapFees` function in the GMX Vault contract:
        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        return _amount * (BASIS_POINTS_DIVISOR - _feeBasisPoints) / BASIS_POINTS_DIVISOR;
    }
}
