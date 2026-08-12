// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2022 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AggregatorTraderBase } from "./AggregatorTraderBase.sol";
import { IParaswapAugustusRouterV6 } from "../interfaces/traders/IParaswapAugustusRouterV6.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   ParaswapAggregatorTraderV3
 * @author  Dolomite
 *
 * Contract for performing an external trade with Paraswap using typesafe decoding of the function calls.
 */
contract ParaswapAggregatorTraderV3 is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ParaswapAggregatorTraderV3";
    uint256 private constant _SCALE_AMOUNT = 1e36;

    // ============ Storage ============

    IParaswapAugustusRouterV6 immutable public PARASWAP_AUGUSTUS_ROUTER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _paraswapAugustusRouter,
        address _dolomiteMargin
    )
    AggregatorTraderBase(_dolomiteMargin)
    {
        PARASWAP_AUGUSTUS_ROUTER = IParaswapAugustusRouterV6(_paraswapAugustusRouter);
    }

    // ============ Public Functions ============

    function exchange(
        address /* _tradeOriginator */,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _minAmountOutAndOrderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(PARASWAP_AUGUSTUS_ROUTER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));
        (
            bytes4 paraswapFunctionSelector,
            bytes memory paraswapCallData
        ) = abi.decode(orderData, (bytes4, bytes));

        _overwriteInputAmountAndCall(_inputAmount, paraswapFunctionSelector, paraswapCallData);
        uint256 outputAmount = IERC20(_outputToken).balanceOf(address(this));

        Require.that(
            outputAmount >= minAmountOutWei,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minAmountOutWei
        );

        IERC20(_outputToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function getExchangeCost(
        address,
        address,
        uint256,
        bytes calldata
    )
    external
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost not implemented")));
    }

    // ============ Private Functions ============

    function _overwriteInputAmountAndCall(
        uint256 _inputAmount,
        bytes4 _paraswapFunctionSelector,
        bytes memory _paraswapCallData
    ) internal {
        if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountIn.selector) {
            (
                address executor,
                IParaswapAugustusRouterV6.GenericData memory swapData,
                uint256 partnerAndFee,
                bytes memory permit,
                bytes memory executorData
            ) = abi.decode(
                _paraswapCallData,
                (address, IParaswapAugustusRouterV6.GenericData, uint256, bytes, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountIn(executor, swapData, partnerAndFee, permit, executorData);
        } else if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountInOnBalancerV2.selector) {
            (
                IParaswapAugustusRouterV6.BalancerV2Data memory swapData,
                uint256 partnerAndFee,
                bytes memory permit,
                bytes memory data
            ) = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouterV6.BalancerV2Data, uint256, bytes, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountInOnBalancerV2(swapData, partnerAndFee, permit, data);
        } else if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountInOnCurveV1.selector) {
            (
                IParaswapAugustusRouterV6.CurveV1Data memory swapData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouterV6.CurveV1Data, uint256, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountInOnCurveV1(swapData, partnerAndFee, permit);
        } else if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountInOnCurveV2.selector) {
            (
                IParaswapAugustusRouterV6.CurveV2Data memory swapData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouterV6.CurveV2Data, uint256, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountInOnCurveV2(swapData, partnerAndFee, permit);
        } else if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountInOnUniswapV2.selector) {
            (
                IParaswapAugustusRouterV6.UniswapV2Data memory swapData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouterV6.UniswapV2Data, uint256, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountInOnUniswapV2(swapData, partnerAndFee, permit);
        } else if (_paraswapFunctionSelector == IParaswapAugustusRouterV6.swapExactAmountInOnUniswapV3.selector) {
            (
                IParaswapAugustusRouterV6.UniswapV3Data memory swapData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouterV6.UniswapV3Data, uint256, bytes)
            );
            swapData.quotedAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.quotedAmount);
            swapData.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.swapExactAmountInOnUniswapV3(swapData, partnerAndFee, permit);
        } else {
            revert(string(abi.encodePacked(
                Require.stringifyTruncated(_FILE),
                ": Invalid Paraswap function selector <",
                Require.stringifyFunctionSelector(_paraswapFunctionSelector),
                ">"
            )));
        }
    }
}
