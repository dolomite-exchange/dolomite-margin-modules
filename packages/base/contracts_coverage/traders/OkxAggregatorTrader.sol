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
import { IOkxAggregator } from "../interfaces/traders/IOkxAggregator.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   OkxAggregatorTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Paraswap using typesafe decoding of the function calls.
 */
contract OkxAggregatorTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "OkxAggregatorTrader";
    uint256 private constant _SCALE_AMOUNT = 1e36;
    bytes4 public constant PMMV2_SWAP_SELECTOR = IOkxAggregator.PMMV2Swap.selector;
    bytes4 public constant PMMV2_SWAP_BY_INVEST_SELECTOR = IOkxAggregator.PMMV2SwapByInvest.selector;
    bytes4 public constant SMART_SWAP_BY_INVEST_SELECTOR = IOkxAggregator.smartSwapByInvest.selector;
    bytes4 public constant SMART_SWAP_BY_ORDER_ID_SELECTOR = IOkxAggregator.smartSwapByOrderId.selector;
    bytes4 public constant UNISWAP_V3_SWAP_TO_SELECTOR = IOkxAggregator.uniswapV3SwapTo.selector;
    bytes4 public constant UNXSWAP_BY_ORDER_ID_SELECTOR = IOkxAggregator.unxswapByOrderId.selector;

    // ============ Storage ============

    IOkxAggregator immutable public OKX_AGGREGATOR; // solhint-disable-line
    address immutable public OKX_TRANSFER_PROXY; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _okxAggregator,
        address _okxTransferProxy,
        address _dolomiteMargin
    )
    AggregatorTraderBase(_dolomiteMargin)
    {
        OKX_AGGREGATOR = IOkxAggregator(_okxAggregator);
        OKX_TRANSFER_PROXY = _okxTransferProxy;
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(OKX_TRANSFER_PROXY), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));
        (
            bytes4 okxFunctionSelector,
            bytes memory okxCallData
        ) = abi.decode(orderData, (bytes4, bytes));

        _overwriteInputAmountAndCall(_inputAmount, okxFunctionSelector, okxCallData);
        uint256 outputAmount = IERC20(_outputToken).balanceOf(address(this));

        if (outputAmount >= minAmountOutWei) { /* FOR COVERAGE TESTING */ }
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
        bytes4 _okxFunctionSelector,
        bytes memory _okxCallData
    ) internal {
        if (_okxFunctionSelector == PMMV2_SWAP_SELECTOR) {
            (
                uint256 orderId,
                IOkxAggregator.PMMBaseRequest memory baseRequest,
                IOkxAggregator.PMMSwapRequest memory request
            ) = abi.decode(
                _okxCallData,
                (uint256, IOkxAggregator.PMMBaseRequest, IOkxAggregator.PMMSwapRequest)
            );

            baseRequest.minReturnAmount = _getScaledExpectedOutputAmount(
                baseRequest.fromTokenAmount,
                _inputAmount,
                baseRequest.minReturnAmount
            );
            baseRequest.fromTokenAmount = _inputAmount;

            OKX_AGGREGATOR.PMMV2Swap(orderId, baseRequest, request);
        } else if (_okxFunctionSelector == PMMV2_SWAP_BY_INVEST_SELECTOR) {
            (
                address receiver,
                IOkxAggregator.PMMBaseRequest memory baseRequest,
                IOkxAggregator.PMMSwapRequest memory request
            ) = abi.decode(
                _okxCallData,
                (address, IOkxAggregator.PMMBaseRequest, IOkxAggregator.PMMSwapRequest)
            );

            baseRequest.minReturnAmount = _getScaledExpectedOutputAmount(
                baseRequest.fromTokenAmount,
                _inputAmount,
                baseRequest.minReturnAmount
            );
            baseRequest.fromTokenAmount = _inputAmount;

            OKX_AGGREGATOR.PMMV2SwapByInvest(receiver, baseRequest, request);
        } else if (_okxFunctionSelector == SMART_SWAP_BY_INVEST_SELECTOR) {
            (
                IOkxAggregator.DexBaseRequest memory baseRequest,
                uint256[] memory batchesAmount,
                IOkxAggregator.DexRouterPath[][] memory batches,
                IOkxAggregator.PMMSwapRequest[] memory extraData,
                address to
            ) = abi.decode(
                _okxCallData,
                (
                    IOkxAggregator.DexBaseRequest,
                    uint256[],
                    IOkxAggregator.DexRouterPath[][],
                    IOkxAggregator.PMMSwapRequest[],
                    address
                )
            );

            baseRequest.minReturnAmount = _getScaledExpectedOutputAmount(
                baseRequest.fromTokenAmount,
                _inputAmount,
                baseRequest.minReturnAmount
            );
            (baseRequest.fromTokenAmount, batchesAmount) = _getScaledBatchAmounts(
                baseRequest.fromTokenAmount,
                _inputAmount, batchesAmount
            );

            OKX_AGGREGATOR.smartSwapByInvest(baseRequest, batchesAmount, batches, extraData, to);
        } else if (_okxFunctionSelector == SMART_SWAP_BY_ORDER_ID_SELECTOR) {
            (
                uint256 orderId,
                IOkxAggregator.DexBaseRequest memory baseRequest,
                uint256[] memory batchesAmount,
                IOkxAggregator.DexRouterPath[][] memory batches,
                IOkxAggregator.PMMSwapRequest[] memory extraData
            ) = abi.decode(
                _okxCallData,
                (
                    uint256,
                    IOkxAggregator.DexBaseRequest,
                    uint256[],
                    IOkxAggregator.DexRouterPath[][],
                    IOkxAggregator.PMMSwapRequest[]
                )
            );

            baseRequest.minReturnAmount = _getScaledExpectedOutputAmount(
                baseRequest.fromTokenAmount,
                _inputAmount,
                baseRequest.minReturnAmount
            );
            (baseRequest.fromTokenAmount, batchesAmount) = _getScaledBatchAmounts(
                baseRequest.fromTokenAmount,
                _inputAmount, batchesAmount
            );

            OKX_AGGREGATOR.smartSwapByOrderId(orderId, baseRequest, batchesAmount, batches, extraData);
        } else if (_okxFunctionSelector == UNISWAP_V3_SWAP_TO_SELECTOR) {
            (
                uint256 recipient,
                uint256 amount,
                uint256 minReturn,
                uint256[] memory pools
            ) = abi.decode(
                _okxCallData,
                (uint256, uint256, uint256, uint256[])
            );

            minReturn = _getScaledExpectedOutputAmount(amount, _inputAmount, minReturn);
            amount = _inputAmount;

            OKX_AGGREGATOR.uniswapV3SwapTo(recipient, amount, minReturn, pools);
        } else if (_okxFunctionSelector == UNXSWAP_BY_ORDER_ID_SELECTOR) {
            (
                uint256 srcToken,
                uint256 amount,
                uint256 minReturn,
                bytes32[] memory pools
            ) = abi.decode(
                _okxCallData,
                (uint256, uint256, uint256, bytes32[])
            );

            minReturn = _getScaledExpectedOutputAmount(amount, _inputAmount, minReturn);
            amount = _inputAmount;

            OKX_AGGREGATOR.unxswapByOrderId(srcToken, amount, minReturn, pools);
        } else {
            revert(string(abi.encodePacked(
                Require.stringifyTruncated(_FILE),
                ": Invalid OkxAggregator function selector <",
                Require.stringifyFunctionSelector(_okxFunctionSelector),
                ">"
            )));
        }
    }

    function _getScaledBatchAmounts(
        uint256 _fromTokenAmount,
        uint256 _actualInputAmount,
        uint256[] memory _batches
    ) internal pure returns (uint256, uint256[] memory) {
        // @follow-up How do we want to handle rounding errors?
        if (_actualInputAmount > _fromTokenAmount) {
            uint256 diff = _actualInputAmount - _fromTokenAmount;
            for (uint256 i; i < _batches.length; i++) {
                _batches[i] += diff * _batches[i] / _fromTokenAmount;
            }
        } else if (_actualInputAmount < _fromTokenAmount) {
            uint256 diff = _fromTokenAmount - _actualInputAmount;
            for (uint256 i; i < _batches.length; i++) {
                _batches[i] -= diff * _batches[i] / _fromTokenAmount;
            }
        }
        return (_actualInputAmount, _batches);
    }
}
