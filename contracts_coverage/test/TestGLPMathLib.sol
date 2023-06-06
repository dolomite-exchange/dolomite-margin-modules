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

import { GLPMathLib } from "../external/glp/GLPMathLib.sol";

import { IGmxRegistryV1 } from "../external/interfaces/IGmxRegistryV1.sol";


/**
 * @title   TestGLPMathLib
 * @author  Dolomite
 *
 * @notice  Contract for testing pure library functions
 */
contract TestGLPMathLib {

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    constructor(address _gmxRegistry) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    function GLPMathLibGetGlpMintAmount(uint256 _usdgAmount) external view returns (uint256 glpAmount) {
        glpAmount = GLPMathLib.getGlpMintAmount(GMX_REGISTRY, _usdgAmount);
    }

    function GLPMathLibGetUsdgAmountForBuy(
        address _inputToken,
        uint256 _inputAmount
    ) external view returns (uint256 usdgAmount) {
        usdgAmount = GLPMathLib.getUsdgAmountForBuy(GMX_REGISTRY.gmxVault(), _inputToken, _inputAmount);
    }

    function GLPMathLibGetGlpRedemptionAmount(
        address _outputToken,
        uint256 _usdgAmount
    ) external view returns (uint256 outputAmount) {
        outputAmount = GLPMathLib.getGlpRedemptionAmount(GMX_REGISTRY.gmxVault(), _outputToken, _usdgAmount);
    }

    function GLPMathLibGetUsdgAmountForSell(uint256 _glpAmount) external view returns (uint256 usdgAmount) {
        usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, _glpAmount);
    }

    function GLPMathLibBasisPointsDivisor() external pure returns (uint256) {
        return GLPMathLib.basisPointsDivisor();
    }

    function GLPMathLibPricePrecision() external pure returns (uint256) {
        return GLPMathLib.pricePrecision();
    }

    function GLPMathLibApplyFeesToAmount(
        uint256 _amount,
        uint256 _feeBasisPoints
    ) external pure returns (uint256) {
        return GLPMathLib.applyFeesToAmount(_amount, _feeBasisPoints);
    }
}
