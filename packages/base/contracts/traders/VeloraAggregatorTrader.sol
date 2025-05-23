// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite.

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
import { IVeloraAugustusSwapper } from "../interfaces/traders/IVeloraAugustusSwapper.sol";
import "../interfaces/traders/AugustusV6Types.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   VeloraAggregatorTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Velora using typesafe decoding of the function calls.
 */
contract VeloraAggregatorTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "VeloraAggregatorTrader";
    uint256 private constant _SCALE_AMOUNT = 1e36;

    bytes4 public constant SWAP_EXACT_AMOUNT_IN_SELECTOR = IVeloraAugustusSwapper.swapExactAmountIn.selector;
    bytes4 public constant SWAP_EXACT_AMOUNT_IN_ON_BALANCER_V2_SELECTOR = IVeloraAugustusSwapper.swapExactAmountInOnBalancerV2.selector;
    bytes4 public constant SWAP_EXACT_AMOUNT_IN_ON_CURVE_V1_SELECTOR = IVeloraAugustusSwapper.swapExactAmountInOnCurveV1.selector;
    bytes4 public constant SWAP_EXACT_AMOUNT_IN_ON_UNISWAP_V2_SELECTOR = IVeloraAugustusSwapper.swapExactAmountInOnUniswapV2.selector;

    // ============ Storage ============

    IVeloraAugustusSwapper immutable public VELORA_AUGUSTUS_SWAPPER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _veloraAugustusSwapper,
        address _dolomiteMargin
    )
    AggregatorTraderBase(_dolomiteMargin)
    {
        VELORA_AUGUSTUS_SWAPPER = IVeloraAugustusSwapper(_veloraAugustusSwapper);
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(VELORA_AUGUSTUS_SWAPPER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));
        (
            bytes4 veloraFunctionSelector,
            bytes memory veloraCallData
        ) = abi.decode(orderData, (bytes4, bytes));

        _overwriteInputAmountAndCall(_inputAmount, veloraFunctionSelector, veloraCallData);
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
        bytes4 _veloraFunctionSelector,
        bytes memory _veloraCallData
    ) internal {
        if (_veloraFunctionSelector == SWAP_EXACT_AMOUNT_IN_SELECTOR) {
            (
                address executor,
                GenericData memory swapData,
                uint256 partnerAndFee,
                bytes memory permit,
                bytes memory executorData
            ) = abi.decode(
                _veloraCallData,
                (address, GenericData, uint256, bytes, bytes)
            );

            swapData.toAmount = _getScaledExpectedOutputAmount(swapData.fromAmount, _inputAmount, swapData.toAmount);
            swapData.fromAmount = _inputAmount;
            VELORA_AUGUSTUS_SWAPPER.swapExactAmountIn(executor, swapData, partnerAndFee, permit, executorData);
        } else if (_veloraFunctionSelector == SWAP_EXACT_AMOUNT_IN_ON_BALANCER_V2_SELECTOR) {
            (
                BalancerV2Data memory balancerData,
                uint256 partnerAndFee,
                bytes memory permit,
                bytes memory data
            ) = abi.decode(
                _veloraCallData,
                (BalancerV2Data, uint256, bytes, bytes)
            );

            balancerData.toAmount = _getScaledExpectedOutputAmount(balancerData.fromAmount, _inputAmount, balancerData.toAmount);
            balancerData.fromAmount = _inputAmount;
            VELORA_AUGUSTUS_SWAPPER.swapExactAmountInOnBalancerV2(balancerData, partnerAndFee, permit, data);
        } else if (_veloraFunctionSelector == SWAP_EXACT_AMOUNT_IN_ON_CURVE_V1_SELECTOR) {
            (
                CurveV1Data memory curveData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _veloraCallData,
                (CurveV1Data, uint256, bytes)
            );

            curveData.toAmount = _getScaledExpectedOutputAmount(curveData.fromAmount, _inputAmount, curveData.toAmount);
            curveData.fromAmount = _inputAmount;
            VELORA_AUGUSTUS_SWAPPER.swapExactAmountInOnCurveV1(curveData, partnerAndFee, permit);
        } else if (_veloraFunctionSelector == SWAP_EXACT_AMOUNT_IN_ON_UNISWAP_V2_SELECTOR) {
            (
                UniswapV2Data memory uniData,
                uint256 partnerAndFee,
                bytes memory permit
            ) = abi.decode(
                _veloraCallData,
                (UniswapV2Data, uint256, bytes)
            );

            uniData.toAmount = _getScaledExpectedOutputAmount(uniData.fromAmount, _inputAmount, uniData.toAmount);
            uniData.fromAmount = _inputAmount;
            VELORA_AUGUSTUS_SWAPPER.swapExactAmountInOnUniswapV2(uniData, partnerAndFee, permit);
        } else {
            revert(string(abi.encodePacked(
                Require.stringifyTruncated(_FILE),
                ": Invalid Velora function selector <",
                Require.stringifyFunctionSelector(_veloraFunctionSelector),
                ">"
            )));
        }
    }
}
