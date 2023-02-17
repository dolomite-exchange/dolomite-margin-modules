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
import { WrappedTokenUserVaultWrapper } from "../proxies/WrappedTokenUserVaultWrapper.sol";


/**
 * @title GLPWrapperProxyV1
 * @author Dolomite
 *
 * @notice  Contract for wrapping GLP via minting from USDC
 */
contract GLPWrapperProxyV1 is WrappedTokenUserVaultWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrapperProxyV1";
    uint256 public constant PRICE_PRECISION = 10 ** 30;
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    // ============ Constructor ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _dfsGlp,
        address _dolomiteMargin
    ) WrappedTokenUserVaultWrapper(
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
        bytes calldata
    )
    external
    view
    returns (uint256) {
        Require.that(
            _makerToken == USDC,
            _FILE,
            "Maker token must be USDC",
            _makerToken
        );
        Require.that(
            _takerToken == address(VAULT_FACTORY), // VAULT_FACTORY is the DFS_GLP token
            _FILE,
            "Taker token must be DS_GLP",
            _takerToken
        );

        // This code is taken from the GMX contracts for calculating the minting amount

        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        // BEGIN gmxVault#buyUSDG (returns the usdgAmount)
        IGmxVault gmxVault = GMX_REGISTRY.gmxVault();
        uint256 price = gmxVault.getMinPrice(_makerToken);
        address usdg = gmxVault.usdg();
        uint256 rawAmount = gmxVault.adjustForDecimals(
            _desiredMakerToken * price / PRICE_PRECISION,
            _makerToken,
            usdg
        );

        uint256 feeBasisPoints = gmxVault.getFeeBasisPoints(
            _makerToken,
            rawAmount,
            gmxVault.mintBurnFeeBasisPoints(),
            gmxVault.taxBasisPoints(),
            true
        );
        uint256 makerAmountAfterFees = _applyFees(_desiredMakerToken, feeBasisPoints);
        uint256 usdgAmount = gmxVault.adjustForDecimals(
            makerAmountAfterFees * price / PRICE_PRECISION,
            _makerToken,
            usdg
        );
        // END gmxVault#buyUSDG

        // https://arbiscan.io/address/0x3963ffc9dff443c2a94f21b129d429891e32ec18#code
        // BEGIN glpManager#_addLiquidity
        uint256 aumInUsdg = GMX_REGISTRY.glpManager().getAumInUsdg(true);
        uint256 glpSupply = GMX_REGISTRY.glp().totalSupply();

        return aumInUsdg == 0 ? usdgAmount : usdgAmount * glpSupply / aumInUsdg;
        // END glpManager#_addLiquidity
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        address _takerToken,
        uint256 _amountTakerToken,
        address,
        bytes calldata _orderData
    )
    internal
    override
    returns (uint256) {
        (uint256 minAmount) = abi.decode(_orderData, (uint256));
        return GMX_REGISTRY.glpRewardsRouter().mintAndStakeGlp(_takerToken, _amountTakerToken, /* _minUsdg = */ 0, minAmount);
    }

    function _applyFees(
        uint256 _amount,
        uint256 _feeBasisPoints
    ) internal pure returns (uint256) {
        // this code is taken from GMX in the `_collectSwapFees` function in the GMX Vault contract:
        // https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        return _amount * (BASIS_POINTS_DIVISOR - _feeBasisPoints) / BASIS_POINTS_DIVISOR;
    }
}
