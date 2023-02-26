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
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGLPRewardsRouterV2 } from "../interfaces/IGLPRewardsRouterV2.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";
import { WrappedTokenUserVaultWrapperTrader } from "../proxies/WrappedTokenUserVaultWrapperTrader.sol";

import { GLPMathLib } from "./GLPMathLib.sol";


/**
 * @title GLPWrapperTraderV1
 * @author Dolomite
 *
 * @notice  Contract for wrapping GLP via minting from USDC
 */
contract GLPWrapperTraderV1 is WrappedTokenUserVaultWrapperTrader {
    using GLPMathLib for IGmxVault;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrapperTraderV1";

    // ============ Constructor ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _dfsGlp,
        address _dolomiteMargin
    ) WrappedTokenUserVaultWrapperTrader(
        _dfsGlp,
        _dolomiteMargin
    ) {
        USDC = _usdc;
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            _makerToken == USDC,
            _FILE,
            "Invalid maker token",
            _makerToken
        );
        Require.that(
            _takerToken == address(VAULT_FACTORY), // VAULT_FACTORY is the DFS_GLP token
            _FILE,
            "Invalid taker token",
            _takerToken
        );

        uint256 usdgAmount = GMX_REGISTRY.gmxVault().getUsdgAmountForBuy(_makerToken, _desiredMakerToken);
        return GLPMathLib.getGlpMintAmount(GMX_REGISTRY, usdgAmount);
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        uint256 _minMakerAmount,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        Require.that(
            _takerToken == USDC,
            _FILE,
            "Invalid taker token",
            _takerToken
        );

        IERC20(_takerToken).safeApprove(address(GMX_REGISTRY.glpManager()), _amountTakerToken);

        return GMX_REGISTRY.glpRewardsRouter().mintAndStakeGlp(
            _takerToken,
            _amountTakerToken,
            /* _minUsdg = */ 0,
            _minMakerAmount
        );
    }

    function _approveWrappedTokenForTransfer(
        address _vault,
        address _receiver,
        uint256 _amount
    )
    internal
    override {
        VAULT_FACTORY.enqueueTransferIntoDolomiteMargin(_vault, _amount);

        IERC20(GMX_REGISTRY.sGlp()).safeApprove(_vault, _amount);
        IERC20(address(VAULT_FACTORY)).safeApprove(_receiver, _amount);
    }
}
