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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GLPMathLib } from "./GLPMathLib.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";
import { WrappedTokenUserVaultWrapperTrader } from "../proxies/abstract/WrappedTokenUserVaultWrapperTrader.sol";


/**
 * @title   GLPWrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for wrapping GLP (via minting from the GLPRewardsRouter) from USDC. Upon settlement, the minted GLP is
 *          sent to the user's vault and dfsGLP is minted to `DolomiteMargin`.
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
        address _inputToken,
        address _vaultToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        if (_inputToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputToken == USDC,
            _FILE,
            "Invalid input token",
            _inputToken
        );
        // VAULT_FACTORY is the DFS_GLP token
        if (_vaultToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(_vaultToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid output token",
            _vaultToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 usdgAmount = GMX_REGISTRY.gmxVault().getUsdgAmountForBuy(_inputToken, _desiredInputAmount);
        return GLPMathLib.getGlpMintAmount(GMX_REGISTRY, usdgAmount);
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        if (_inputToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputToken == USDC,
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        IERC20(_inputToken).safeApprove(address(GMX_REGISTRY.glpManager()), _inputAmount);

        return GMX_REGISTRY.glpRewardsRouter().mintAndStakeGlp(
            _inputToken,
            _inputAmount,
            /* _minUsdg = */ 0,
            _minOutputAmount
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
