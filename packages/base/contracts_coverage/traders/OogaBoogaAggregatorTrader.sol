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
import { IOogaBoogaRouter } from "../interfaces/traders/IOogaBoogaRouter.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   OogaBoogaAggregatorTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Ooga Booga.
 */
contract OogaBoogaAggregatorTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "OogaBoogaAggregatorTrader";

    // ============ Storage ============

    IOogaBoogaRouter immutable public OOGA_BOOGA_ROUTER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _oogaBoogaRouter,
        address _dolomiteMargin
    )
        AggregatorTraderBase(_dolomiteMargin)
    {
        OOGA_BOOGA_ROUTER = IOogaBoogaRouter(_oogaBoogaRouter);
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(OOGA_BOOGA_ROUTER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));

        uint256 outputAmount;
        {
            // Create a new scope to avoid "stack the stack too deep" error
            (
                IOogaBoogaRouter.swapTokenInfo memory tokenInfo,
                bytes memory pathDefinition,
                address executor,
                uint32 referralCode
            ) = abi.decode(orderData, (IOogaBoogaRouter.swapTokenInfo, bytes, address, uint32));
            tokenInfo.outputQuote = _getScaledExpectedOutputAmount(
                tokenInfo.inputAmount,
                _inputAmount,
                tokenInfo.outputQuote
            );
            tokenInfo.outputMin = minAmountOutWei;
            tokenInfo.inputAmount = _inputAmount;

            outputAmount = OOGA_BOOGA_ROUTER.swap(
                tokenInfo,
                pathDefinition,
                executor,
                referralCode
            );
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