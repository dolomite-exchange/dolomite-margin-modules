// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";


/**
 * @title GLPMathLib
 * @author Dolomite
 *
 * @notice  A library contract that contains helper functions for common math that GLP code needs to perform.
 */
library GLPMathLib {

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    function applyFeesToAmount(
        uint256 _amount,
        uint256 _feeBasisPoints
    ) internal pure returns (uint256) {
        // this code is taken from GMX in the `_collectSwapFees` function in the GMX Vault contract:
        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        return _amount * (BASIS_POINTS_DIVISOR - _feeBasisPoints) / BASIS_POINTS_DIVISOR;
    }
}
