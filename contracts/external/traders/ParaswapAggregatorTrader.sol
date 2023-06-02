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


/**
 * @title ParaswapAggregatorTrader
 * @author Dolomite
 *
 * Contract for performing an external trade with Paraswap.
 */
contract ParaswapAggregatorTrader is OnlyDolomiteMargin, IDolomiteMarginExchangeWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ParaswapAggregatorTrader";

    // ============ Storage ============

    address immutable public PARASWAP_AUGUSTUS_ROUTER; // solhint-disable-line
    address immutable public PARASWAP_TRANSFER_PROXY; // solhint-disable-line

    // ============ Constructor ============

    constructor(
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(_dolomiteMargin)
    {
        PARASWAP_AUGUSTUS_ROUTER = _paraswapAugustusRouter;
        PARASWAP_TRANSFER_PROXY = _paraswapTransferProxy;
    }

    // ============ Public Functions ============

    function exchange(
        address /* _tradeOriginator */,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _requestedFillAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        if (IERC20(_takerToken).allowance(address(this), PARASWAP_TRANSFER_PROXY) > 0) {
            // If the allowance is already set, set it to 0 first
            IERC20(_takerToken).safeApprove(PARASWAP_TRANSFER_PROXY, 0);
        }
        IERC20(_takerToken).safeApprove(PARASWAP_TRANSFER_PROXY, _requestedFillAmount);

        (uint256 minAmountOutWei, bytes memory paraswapCallData) = abi.decode(_orderData, (uint256, bytes));

        _callAndCheckSuccess(paraswapCallData);

        uint256 amount = IERC20(_makerToken).balanceOf(address(this));

        Require.that(
            amount >= minAmountOutWei,
            _FILE,
            "Insufficient output amount",
            amount,
            minAmountOutWei
        );

        IERC20(_makerToken).safeApprove(_receiver, _requestedFillAmount);

        return amount;
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

    function _callAndCheckSuccess(bytes memory _paraswapCallData) internal {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory result) = PARASWAP_AUGUSTUS_ROUTER.call(_paraswapCallData);
        if (!success) {
            if (result.length < 68) {
                revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": revert")));
            } else {
                // solium-disable-next-line security/no-inline-assembly
                assembly {
                    result := add(result, 0x04)
                }
                revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": ", abi.decode(result, (string)))));
            }
        }
    }
}
