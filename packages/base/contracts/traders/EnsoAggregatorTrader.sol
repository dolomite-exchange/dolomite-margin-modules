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
import { IEnsoRouter } from "../interfaces/traders/IEnsoRouter.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   EnsoAggregatorTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with Enso.
 */
contract EnsoAggregatorTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "EnsoAggregatorTrader";

    // ============ Storage ============

    IEnsoRouter immutable public ENSO_ROUTER; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _ensoRouter,
        address _dolomiteMargin
    )
        AggregatorTraderBase(_dolomiteMargin)
    {
        ENSO_ROUTER = IEnsoRouter(_ensoRouter);
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
        ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(ENSO_ROUTER), _inputAmount);

        (
            uint256 minAmountOutWei,
            bytes memory orderData
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));

        (
            uint256[] memory pointers,
            uint256 originalInputAmount,
            bytes memory fullData
        ) = abi.decode(orderData, (uint256[], uint256, bytes));
        _overwriteInputAmount(fullData, pointers, _inputAmount);

        {
            (
                IEnsoRouter.Token memory tokenIn,
                bytes memory data
            ) = abi.decode(fullData, (IEnsoRouter.Token, bytes));

            ENSO_ROUTER.routeSingle(
                tokenIn,
                data
            );
        }
        uint256 outputAmount = IERC20(_outputToken).balanceOf(address(this));

        Require.that(
            outputAmount >= _getScaledExpectedOutputAmount(originalInputAmount, _inputAmount, minAmountOutWei),
            _FILE,
            "Insufficient output amount"
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

    function _overwriteInputAmount(
        bytes memory _fullData,
        uint256[] memory _pointers,
        uint256 _inputAmount
    ) internal pure {
        uint256 len = _pointers.length;
        for (uint256 i; i < len; ++i) {
            uint256 pointer = _pointers[i];
            Require.that(
                pointer <= _fullData.length - 32,
                _FILE,
                "Pointer is out of bounds"
            );

            assembly {
                // Overwrite the input amount at the specified pointer location
                // _pointer is the offset from the start of the data (after the length field)
                mstore(add(_fullData, add(pointer, 32)), _inputAmount)
            }
        }
    }
}
