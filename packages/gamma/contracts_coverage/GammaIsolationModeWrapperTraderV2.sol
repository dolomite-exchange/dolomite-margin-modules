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

import { IsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeWrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IDolomiteMarginExchangeWrapper } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginExchangeWrapper.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDeltaSwapPair } from "./interfaces/IDeltaSwapPair.sol";
import { IDeltaSwapRouter } from "./interfaces/IDeltaSwapRouter.sol";
import { IGammaIsolationModeVaultFactory } from "./interfaces/IGammaIsolationModeVaultFactory.sol";
import { IGammaPool } from "./interfaces/IGammaPool.sol";
import { IGammaPositionManager } from "./interfaces/IGammaPositionManager.sol";
import { IGammaRegistry } from "./interfaces/IGammaRegistry.sol";

import "hardhat/console.sol";


/**
 * @title   GammaIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping gamma lp pool (via swapping and then minting)
 */
contract GammaIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GammaWrapperTraderV2";

    // ============ State Variables ============

    IGammaRegistry public immutable GAMMA_REGISTRY; // solhint-disable-line var-name-mixedcase
    IGammaPool public immutable GAMMA_POOL; // solhint-disable-line var-name-mixedcase
    IDeltaSwapPair public immutable DELTA_SWAP_PAIR; // solhint-disable-line var-name-mixedcase
    

    // ============ Constructor ============

    constructor(
        address _gammaRegistry,
        address _dGammaPool,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV2(
        _dGammaPool,
        _dolomiteMargin,
        address(IGammaRegistry(_gammaRegistry).dolomiteRegistry())
    ) {
        GAMMA_REGISTRY = IGammaRegistry(_gammaRegistry);
        GAMMA_POOL = IGammaPool(IGammaIsolationModeVaultFactory(_dGammaPool).UNDERLYING_TOKEN());
        DELTA_SWAP_PAIR = IDeltaSwapPair(GAMMA_POOL.cfmm());
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == DELTA_SWAP_PAIR.token0() || _inputToken == DELTA_SWAP_PAIR.token1();
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address /* _outputTokenUnderlying */,
        uint256 /* _minOutputAmount */,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        uint256 swapAmount = _inputAmount / 2;
        address token0 = DELTA_SWAP_PAIR.token0();
        address token1 = DELTA_SWAP_PAIR.token1();
        address aggregatorOutputToken = token0 == _inputToken ? token1 : token0;

        uint256 token0PreBal = _inputToken == token0 
            ? IERC20(token0).balanceOf(address(this)) - _inputAmount
            : IERC20(token0).balanceOf(address(this));
        uint256 token1PreBal = _inputToken == token1
            ? IERC20(token1).balanceOf(address(this)) - _inputAmount
            : IERC20(token1).balanceOf(address(this));

        uint256 outputAmount = _doAggregatorSwap(_inputToken, aggregatorOutputToken, swapAmount, _extraOrderData);
        uint256 amountOut1 = _depositReserves(
            aggregatorOutputToken == token0 ? outputAmount : _inputAmount - swapAmount, 
            aggregatorOutputToken == token1 ? outputAmount : _inputAmount - swapAmount,
            token0,
            token1
        );

        uint256 amountOut2;
        (uint256 token0Amount, uint256 token1Amount) = _doDeltaSwap(token0, token1, token0PreBal, token1PreBal);
        if (token0Amount > 0 && token1Amount > 0) {
            amountOut2 = _depositReserves(token0Amount, token1Amount, token0, token1);
        }

        _retrieveDust(token0, token1);

        return amountOut1 + amountOut2;
    }

    function _depositReserves(
        uint256 _tokenAmount0,
        uint256 _tokenAmount1,
        address _token0,
        address _token1
    ) public returns (uint256) {
        uint256[] memory amountsDesired = new uint256[](2);
        amountsDesired[0] = _tokenAmount0;
        amountsDesired[1] = _tokenAmount1;
        uint256[] memory amountsMin = new uint256[](2);
        amountsMin[0] = 1;
        amountsMin[1] = 1;

        IERC20(_token0).safeApprove(address(GAMMA_REGISTRY.gammaPositionManager()), _tokenAmount0);
        IERC20(_token1).safeApprove(address(GAMMA_REGISTRY.gammaPositionManager()), _tokenAmount1);

        IGammaPositionManager.DepositReservesParams memory depositReservesParams = 
            IGammaPositionManager.DepositReservesParams({
                protocolId: GAMMA_POOL.protocolId(),
                cfmm: GAMMA_POOL.cfmm(),
                to: address(this),
                deadline: block.timestamp,
                amountsDesired: amountsDesired,
                amountsMin: amountsMin
            });
        (, uint256 amountOut) = GAMMA_REGISTRY.gammaPositionManager().depositReserves(depositReservesParams);

        IERC20(_token0).safeApprove(address(GAMMA_REGISTRY.gammaPositionManager()), 0);
        IERC20(_token1).safeApprove(address(GAMMA_REGISTRY.gammaPositionManager()), 0);

        return amountOut;
    }

    function _doAggregatorSwap(
        address _inputToken,
        address _outputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) internal returns (uint256) {
        (address aggregator, bytes memory aggregatorData) = abi.decode(_extraOrderData, (address, bytes));
        IERC20(_inputToken).safeTransfer(aggregator, _inputAmount);
        return IDolomiteMarginExchangeWrapper(aggregator).exchange(
            /* tradeOriginator = */ address(this),
            /* receiver = */ address(this),
            /* outputToken = */ _outputToken,
            /* inputToken = */ _inputToken,
            /* inputAmount = */ _inputAmount,
            /* minAmountOutAndOrderData */ aggregatorData
        );
    }

    function _doDeltaSwap(
        address _token0,
        address _token1,
        uint256 _token0PreBal,
        uint256 _token1PreBal
    ) internal returns (uint256, uint256) {
        uint256 amount = IERC20(_token0).balanceOf(address(this)) - _token0PreBal;
        address inputToken = _token0;
        if (amount == 0) {
            amount = IERC20(_token1).balanceOf(address(this)) - _token1PreBal;
            inputToken = _token1;
        }

        if (amount == 0) {
            return (0, 0);
        }

        uint256 swapAmount = amount / 2;
        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = inputToken == _token0 ? _token1 : _token0;

        IDeltaSwapRouter router = GAMMA_REGISTRY.deltaSwapRouter();
        IERC20(inputToken).safeApprove(address(router), swapAmount);
        uint256[] memory amountsOut = GAMMA_REGISTRY.deltaSwapRouter().swapExactTokensForTokens(
            /* amountIn = */ swapAmount,
            /* amountOutMin = */ 1,
            /* path = */ path,
            /* to = */ address(this),
            /* deadline = */ block.timestamp
        );

        if (inputToken == _token0) {
            return (amount - swapAmount, amountsOut[1]);
        } else {
            return (amountsOut[1], amount - swapAmount);
        }
    }

    function _retrieveDust(address _token0, address _token1) internal {
        uint256 dust0 = IERC20(_token0).balanceOf(address(this));
        uint256 dust1 = IERC20(_token1).balanceOf(address(this));
        address owner = DOLOMITE_MARGIN().owner();
        if (dust0 > 0) {
            IERC20(_token0).safeTransfer(owner, dust0);
        }
        if (dust1 > 0) {
            IERC20(_token1).safeTransfer(owner, dust1);
        }
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256)
    {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
