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

import { IDolomiteMarginExchangeWrapper } from "../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";

import { Require } from "../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IOdosRouter } from "../interfaces/traders/IOdosRouter.sol";

import { ERC20Lib } from "../lib/ERC20Lib.sol";


/**
 * @title   OdosAggregatorTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Odos using typesafe decoding of the function calls.
 */
contract OdosAggregatorTrader is OnlyDolomiteMargin, IDolomiteMarginExchangeWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "OdosAggregatorTrader";
    uint256 private constant _SCALE_AMOUNT = 1e36;

    // ============ Storage ============

    IOdosRouter immutable public ODOS_ROUTER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _odosRouter,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        ODOS_ROUTER = IOdosRouter(_odosRouter);
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(ODOS_ROUTER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));

        uint256 outputAmount;
        {
            // Create a new scope to avoid "stack the stack too deep" error
            (
                IOdosRouter.SwapTokenInfo memory tokenInfo,
                bytes memory pathDefinition,
                address executor,
                uint32 referralCode
            ) = abi.decode(orderData, (IOdosRouter.SwapTokenInfo, bytes, address, uint32));
            tokenInfo.outputQuote = _getScaledExpectedOutputAmount(
                tokenInfo.inputAmount,
                _inputAmount,
                tokenInfo.outputQuote
            );
            tokenInfo.outputMin = minAmountOutWei;
            tokenInfo.inputAmount = _inputAmount;

            outputAmount = ODOS_ROUTER.swap(
                tokenInfo,
                pathDefinition,
                executor,
                referralCode
            );
        }

        // Panic if the output amount is insufficient
        assert(outputAmount >= minAmountOutWei);

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

    function _getScaledExpectedOutputAmount(
        uint256 _originalInputAmount,
        uint256 _actualInputAmount,
        uint256 _expectedOutputAmount
    ) private pure returns (uint256) {
        if (_originalInputAmount >= _actualInputAmount) {
            return _expectedOutputAmount;
        } else {
            // The amount inputted to the Paraswap API was less than what we're actually trading. Scale up the expected
            // amount out, so the user doesn't pay unnecessary positive slippage
            uint256 percentageUp = _actualInputAmount * _SCALE_AMOUNT / _originalInputAmount;
            return _expectedOutputAmount * percentageUp / _SCALE_AMOUNT;
        }
    }
}
