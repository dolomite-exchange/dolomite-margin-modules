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

import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IParaswapAugustusRouter } from "../interfaces/traders/IParaswapAugustusRouter.sol";

import { ERC20Lib } from "../lib/ERC20Lib.sol";


/**
 * @title   ParaswapAggregatorTraderV2
 * @author  Dolomite
 *
 * Contract for performing an external trade with Paraswap using typesafe decoding of the function calls.
 */
contract ParaswapAggregatorTraderV2 is OnlyDolomiteMargin, IDolomiteMarginExchangeWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ParaswapAggregatorTraderV2";
    uint256 private constant _SCALE_AMOUNT = 1e36;
    bytes4 public constant MEGA_SWAP_SELECTOR = IParaswapAugustusRouter.megaSwap.selector; // 0x46c67b6d
    bytes4 public constant MULTI_SWAP_SELECTOR = IParaswapAugustusRouter.multiSwap.selector; // 0xa94e78ef
    bytes4 public constant SIMPLE_SWAP_SELECTOR = IParaswapAugustusRouter.simpleSwap.selector; // 0x54e3f31b

    // ============ Storage ============

    IParaswapAugustusRouter immutable public PARASWAP_AUGUSTUS_ROUTER; // solhint-disable-line
    address immutable public PARASWAP_TRANSFER_PROXY; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(_dolomiteMargin)
    {
        PARASWAP_AUGUSTUS_ROUTER = IParaswapAugustusRouter(_paraswapAugustusRouter);
        PARASWAP_TRANSFER_PROXY = _paraswapTransferProxy;
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), PARASWAP_TRANSFER_PROXY, _inputAmount);

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
        bytes4 _paraswapFunctionSelector,
        bytes memory _paraswapCallData
    ) internal {
        if (_paraswapFunctionSelector == MEGA_SWAP_SELECTOR) {
            IParaswapAugustusRouter.MegaSwapSellData memory data = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouter.MegaSwapSellData)
            );
            data.expectedAmount = _getScaledExpectedOutputAmount(data.fromAmount, _inputAmount, data.expectedAmount);
            data.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.megaSwap(data);
        } else if (_paraswapFunctionSelector == MULTI_SWAP_SELECTOR) {
            IParaswapAugustusRouter.MultiSwapSellData memory data = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouter.MultiSwapSellData)
            );
            data.expectedAmount = _getScaledExpectedOutputAmount(data.fromAmount, _inputAmount, data.expectedAmount);
            data.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.multiSwap(data);
        } else if (_paraswapFunctionSelector == SIMPLE_SWAP_SELECTOR) {
            IParaswapAugustusRouter.SimpleSwapSellData memory data = abi.decode(
                _paraswapCallData,
                (IParaswapAugustusRouter.SimpleSwapSellData)
            );
            data.expectedAmount = _getScaledExpectedOutputAmount(data.fromAmount, _inputAmount, data.expectedAmount);
            data.fromAmount = _inputAmount;
            PARASWAP_AUGUSTUS_ROUTER.simpleSwap(data);
        } else {
            revert(string(abi.encodePacked(
                Require.stringifyTruncated(_FILE),
                ": Invalid Paraswap function selector <",
                Require.stringifyFunctionSelector(_paraswapFunctionSelector),
                ">"
            )));
        }
    }

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
