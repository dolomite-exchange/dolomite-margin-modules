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
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

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

    bytes32 private constant _FILE = "GLPPriceOracleV1";

    uint256 public constant GLP_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10000;

    // ============================ Public State Variables ============================

    IGLPManager immutable public GLP_MANAGER; // solhint-disable-line var-name-mixedcase
    IGMXVault immutable public GMX_VAULT; // solhint-disable-line var-name-mixedcase
    IERC20 immutable public GLP; // solhint-disable-line var-name-mixedcase
    IERC20 immutable public DS_GLP; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _glpManager,
        address _gmxVault,
        address _glp,
        address _dsGlp
    ) {
        GLP_MANAGER = IGLPManager(_glpManager);
        GMX_VAULT = IGMXVault(_gmxVault);
        GLP = IERC20(_glp);
        DS_GLP = IERC20(_dsGlp);
    }

    function getPrice(
        address token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            token == address(DS_GLP),
            _FILE,
            "invalid token"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 fee = GMX_VAULT.mintBurnFeeBasisPoints() + GMX_VAULT.taxBasisPoints();
        uint256 rawPrice = GLP_MANAGER.getAumInUsdg(false) * GLP_PRECISION / GLP.totalSupply();
        // understate the price by the fees needed to burn GLP for USDG. This is okay to do because GLP cannot be
        // borrowed.
        return rawPrice - (rawPrice * fee / FEE_PRECISION);
    }
}
