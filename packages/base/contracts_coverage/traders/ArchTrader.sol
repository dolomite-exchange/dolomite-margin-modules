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
import { IAlgebraSwapRouter } from "../interfaces/traders/IAlgebraSwapRouter.sol";
import { IAlgebraSwapQuoter } from "../interfaces/traders/IAlgebraSwapQuoter.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   ArchTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Arch.
 */
contract ArchTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ArchTrader";

    // ============ Storage ============

    IAlgebraSwapRouter immutable public ARCH_SWAP_ROUTER; // solhint-disable-line
    IAlgebraSwapQuoter immutable public ARCH_SWAP_QUOTER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _archSwapRouter,
        address _archSwapQuoter,
        address _dolomiteMargin
    )
        AggregatorTraderBase(_dolomiteMargin)
    {
        ARCH_SWAP_ROUTER = IAlgebraSwapRouter(_archSwapRouter);
        ARCH_SWAP_QUOTER = IAlgebraSwapQuoter(_archSwapQuoter);
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(ARCH_SWAP_ROUTER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));

        uint256 outputAmount;
        if (orderData.length == 0) {
            IAlgebraSwapRouter.ExactInputSingleParams memory params =
                IAlgebraSwapRouter.ExactInputSingleParams({
                    tokenIn: _inputToken,
                    tokenOut: _outputToken,
                    deployer: address(0),
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: _inputAmount,
                    amountOutMinimum: 0,
                    limitSqrtPrice: 0
                });
            outputAmount = ARCH_SWAP_ROUTER.exactInputSingle(params);
        } else {
            IAlgebraSwapRouter.ExactInputParams memory params =
                IAlgebraSwapRouter.ExactInputParams({
                    path: orderData,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: _inputAmount,
                    amountOutMinimum: 0
                });
            outputAmount = ARCH_SWAP_ROUTER.exactInput(params);
        }

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
}
