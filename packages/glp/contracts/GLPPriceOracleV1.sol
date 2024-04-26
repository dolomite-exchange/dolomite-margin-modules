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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IGLPManager } from "./interfaces/IGLPManager.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";


/**
 * @title   GLPPriceOracleV1
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that makes GMX's GLP prices compatible with the
 *          protocol. The GLP price it calculates understates the price by using the highest bid and factors in any
 *          withdrawal fees. This is okay to do because GLP cannot be borrowed.
 */
contract GLPPriceOracleV1 is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GLPPriceOracleV1";

    uint256 public constant GLP_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10_000;

    // ============================ Public State Variables ============================

    IERC20 immutable public DFS_GLP; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 immutable public GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _gmxRegistry,
        address _dsGlp
    ) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        DFS_GLP = IERC20(_dsGlp);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(DFS_GLP),
            _FILE,
            "invalid token"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    function glp() public view returns (IERC20) {
        return GMX_REGISTRY.glp();
    }

    function glpManager() public view returns (IGLPManager) {
        return GMX_REGISTRY.glpManager();
    }

    function gmxVault() public view returns (IGmxVault) {
        return GMX_REGISTRY.gmxVault();
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        IGmxVault _gmxVault = gmxVault();
        uint256 fee = _gmxVault.mintBurnFeeBasisPoints() + _gmxVault.taxBasisPoints();
        uint256 totalSupply = glp().totalSupply();

        // total supply should always be > 0 if the user is using GLP and interacting with Dolomite
        assert(totalSupply > 0);

        uint256 rawPrice = glpManager().getAumInUsdg(false) * GLP_PRECISION / totalSupply;
        // understate the price by the fees needed to burn GLP for USDG. This is okay to do because GLP cannot be
        // borrowed.
        return rawPrice - (rawPrice * fee / FEE_PRECISION);
    }
}
