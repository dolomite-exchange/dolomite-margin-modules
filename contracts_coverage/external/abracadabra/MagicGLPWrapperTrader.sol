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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { GLPMathLib } from "../glp/GLPMathLib.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IDolomiteMarginWrapperTrader } from "../interfaces/IDolomiteMarginWrapperTrader.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   MagicGLPWrapperTrader
 * @author  Dolomite
 *
 * @notice  Used for wrapping any supported token into magicGLP. Upon settlement, the minted magicGLP is sent to
 *          DolomiteMargin, like normally
 */
contract MagicGLPWrapperTrader is IDolomiteMarginWrapperTrader, OnlyDolomiteMargin {
    using GLPMathLib for IGmxVault;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MagicGLPWrapperTrader";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ============ Constructor ============

    IERC4626 public immutable MAGIC_GLP; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _magicGlp,
        address _gmxRegistry,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        MAGIC_GLP = IERC4626(_magicGlp);
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function exchange(
        address,
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
        Require.that(GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(_outputToken == address(MAGIC_GLP),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputAmount > 0,
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

        // approve GLP and mint magicGLP
        IERC20(GMX_REGISTRY.sGlp()).safeApprove(address(MAGIC_GLP), glpAmount);
        uint256 magicGlpAmount = MAGIC_GLP.deposit(glpAmount, address(this));

        // approve magicGLP for receiver and return the amount
        IERC20(_outputToken).safeApprove(_receiver, magicGlpAmount);
        return magicGlpAmount;
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        if (GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(_outputToken == address(MAGIC_GLP),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 usdgAmount = GMX_REGISTRY.gmxVault().getUsdgAmountForBuy(_inputToken, _desiredInputAmount);
        uint256 glpAmount = GLPMathLib.getGlpMintAmount(GMX_REGISTRY, usdgAmount);
        return MAGIC_GLP.previewDeposit(glpAmount);
    }

    function createActionsForWrapping(
        uint256 _solidAccountId,
        uint256,
        address,
        address,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256,
        uint256 _inputAmount
    )
    public
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarket) == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarket) == address(MAGIC_GLP),
            _FILE,
            "Invalid output market",
            _outputMarket
        );
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN.getMarketTokenAddress(_inputMarket),
            DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarket),
            _inputAmount,
            /* _orderData = */ bytes("")
        );

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ amountOut,
            bytes("")
        );

        return actions;
    }

    function actionsLength() public pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }
}
