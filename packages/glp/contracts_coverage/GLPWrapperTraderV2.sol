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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginExchangeWrapper.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GLPMathLib } from "./GLPMathLib.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";


/**
 * @title   GLPWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping any supported token into GLP
 */
contract GLPWrapperTraderV2 is IDolomiteMarginExchangeWrapper, OnlyDolomiteMargin {
    using GLPMathLib for IGmxVault;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrapperTraderV2";

    // ============ Constructor ============

    IERC20 public immutable GLP; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _glp,
        address _gmxRegistry,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        GLP = IERC20(_glp);
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function exchange(
        address /* _tradeOriginator */,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        if (GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == address(GLP),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // approve input token and mint GLP
        IERC20(_inputToken).safeApprove(address(GMX_REGISTRY.glpManager()), _inputAmount);
        (uint256 minOutputAmount) = abi.decode(_orderData, (uint256));
        uint256 glpAmount = GMX_REGISTRY.glpRewardsRouter().mintAndStakeGlp(
            _inputToken,
            _inputAmount,
            /* _minUsdg = */ 0,
            minOutputAmount
        );

        // approve GLP for receiver and return the amount
        IERC20(_outputToken).safeApprove(_receiver, glpAmount);
        return glpAmount;
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory /* _orderData */
    )
    public
    override
    view
    returns (uint256) {
        if (GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == address(GLP),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 usdgAmount = GMX_REGISTRY.gmxVault().getUsdgAmountForBuy(_inputToken, _desiredInputAmount);
        return GLPMathLib.getGlpMintAmount(GMX_REGISTRY, usdgAmount);
    }
}
