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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGMXVault } from "../interfaces/IGMXVault.sol";


/**
 * @title GLPPriceOracleV1
 * @author Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that makes GMX's GLP prices compatible with the
 *          protocol. The GLP price it calculates understates the price by the withdrawal fees.
 */
contract GLPPriceOracleV1 is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant FILE = "GLPPriceOracleV1";

    uint256 public constant GLP_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10000;

    // ============================ Public State Variables ============================

    IGLPManager immutable public glpManager;
    IGMXVault immutable public gmxVault;
    IERC20 immutable public glp;
    IERC20 immutable public dsGlp;

    // ============================ Constructor ============================

    constructor(
        address _glpManager,
        address _gmxVault,
        address _glp,
        address _dsGlp
    ) {
        glpManager = IGLPManager(_glpManager);
        gmxVault = IGMXVault(_gmxVault);
        glp = IERC20(_glp);
        dsGlp = IERC20(_dsGlp);
    }

    function getPrice(
        address token
    )
    public
    view
    returns (IDolomiteMargin.MonetaryPrice memory) {
        Require.that(
            token == address(dsGlp),
            FILE,
            "invalid token"
        );

        return IDolomiteMargin.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 fee = gmxVault.mintBurnFeeBasisPoints() + gmxVault.taxBasisPoints();
        uint256 rawPrice = glpManager.getAumInUsdg(false) * GLP_PRECISION / glp.totalSupply();
        // understate the price by the fees needed to burn GLP for USDG. This is okay to do because GLP cannot be
        // borrowed.
        return rawPrice - (rawPrice * fee / FEE_PRECISION);
    }
}
