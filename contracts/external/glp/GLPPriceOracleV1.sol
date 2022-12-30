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

import { IChainlinkAutomation } from "../interfaces/IChainlinkAutomation.sol";
import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGMXVault } from "../interfaces/IGMXVault.sol";


/**
 * @title GLPPriceOracleV1
 * @author Dolomite
 *
 *  An implementation of the IDolomitePriceOracle interface that makes GMX's GLP prices compatible with the protocol. It
 *  uses a 15-minute TWAP price of the GLP, accounting for fees and slippage.
 */
contract GLPPriceOracleV1 is IDolomitePriceOracle, IChainlinkAutomation {

    // ============================ Events ============================

    event OraclePriceUpdated(uint256 oraclePrice, uint256 cumulativePrice);

    // ============================ Constants ============================

    bytes32 private constant FILE = "GLPPriceOracleV1";

    uint256 public constant GLP_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10000;
    uint256 public constant UPDATE_DURATION = 15 minutes;
    uint256 public constant EXPIRATION_DURATION = 12 hours;

    // ============================ Public State Variables ============================

    address public glpManager;
    address public gmxVault;
    address public glp;
    address public dsGlp;
    uint256 public priceCumulative;
    uint256 public lastOraclePriceUpdateTimestamp;

    // ============================ Private State Variables ============================

    uint256 private oraclePrice;

    // ============================ Modifiers ============================

    /**
     * @notice A modifier that allows it to be simulated via eth_call by checking that the sender is the zero address.
     */
    modifier cannotExecute() {
        // solium-disable security/no-tx-origin
        Require.that(
            tx.origin == address(0),
            FILE,
            "Must execute via eth_call"
        );
        // solium-enable security/no-tx-origin
        _;
    }

    // ============================ Constructor ============================

    constructor(
        address _glpManager,
        address _gmxVault,
        address _glp,
        address _dsGlp
    ) public {
        glpManager = _glpManager;
        gmxVault = _gmxVault;
        glp = _glp;
        dsGlp = _dsGlp;

        lastOraclePriceUpdateTimestamp = block.timestamp - EXPIRATION_DURATION;
    }

    function checkUpkeep(
        bytes calldata
    )
    external
    cannotExecute
    returns (bool upkeepNeeded, bytes memory /* performData */) {
        upkeepNeeded = (block.timestamp - lastOraclePriceUpdateTimestamp) >= UPDATE_DURATION;
        return (upkeepNeeded, bytes(""));
    }

    function performUpkeep(bytes calldata) external {
        uint256 timeElapsed = block.timestamp - lastOraclePriceUpdateTimestamp;
        Require.that(
            timeElapsed >= UPDATE_DURATION,
            FILE,
            "update not allowed yet"
        );


        // Enough time has passed to perform an oracle update
        uint256 priceCumulativeLast = priceCumulative;
        uint256 priceCumulativeNew = priceCumulativeLast + (timeElapsed * _getCurrentPrice());
        uint256 oraclePriceNew = priceCumulativeNew - (priceCumulativeLast / timeElapsed);

        priceCumulative = priceCumulativeNew;
        oraclePrice = oraclePriceNew;
        lastOraclePriceUpdateTimestamp = block.timestamp;

        emit OraclePriceUpdated(oraclePriceNew, priceCumulativeNew);
    }

    function getPrice(
        address token
    )
    public
    view
    returns (IDolomiteMargin.MonetaryPrice memory) {
        uint256 _oraclePrice = oraclePrice;
        Require.that(
            _oraclePrice != 0,
            FILE,
            "oracle price not set"
        );
        Require.that(
            token == dsGlp,
            FILE,
            "invalid token"
        );
        Require.that(
            block.timestamp - lastOraclePriceUpdateTimestamp < EXPIRATION_DURATION,
            FILE,
            "oracle price expired"
        );

        return IDolomiteMargin.MonetaryPrice({
            value: _oraclePrice
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        IGMXVault _gmxVault = IGMXVault(gmxVault);
        IGLPManager _glpManager = IGLPManager(glpManager);
        IERC20 _glp = IERC20(glp);

        uint256 fee = _gmxVault.mintBurnFeeBasisPoints() + _gmxVault.taxBasisPoints();
        uint256 rawPrice = _glpManager.getAumInUsdg(false) * GLP_PRECISION / _glp.totalSupply();
        return rawPrice - (rawPrice * fee / FEE_PRECISION);
    }
}
