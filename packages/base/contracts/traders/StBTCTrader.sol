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
import { IStBTC } from "../interfaces/traders/IStBTC.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   StBTCTrader
 * @author  Dolomite
 *
 * Contract for performing an external trade with StBTC.
 */
contract StBTCTrader is AggregatorTraderBase {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "StBTCTrader";

    // ============ Storage ============

    address immutable public PBTC;
    IStBTC immutable public STBTC;

    // ============ Constructor ============

    constructor(
        address _pBTC,
        address _stBTC,
        address _dolomiteMargin
    )
        AggregatorTraderBase(_dolomiteMargin)
    {
        PBTC = _pBTC;
        STBTC = IStBTC(_stBTC);
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
        uint256 outputAmount;
        if (_inputToken == PBTC && _outputToken == address(STBTC)) {
            ERC20Lib.resetAllowanceIfNeededAndApprove(IERC20(_inputToken), address(STBTC), _inputAmount);

            outputAmount = STBTC.directDeposit(_inputAmount, address(this));
        } else if (_inputToken == address(STBTC) && _outputToken == PBTC) {
            outputAmount = STBTC.redeem(_inputAmount, address(this), address(this));
        } else {
            revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": Invalid trade")));
        }

        (
            uint256 minAmountOutWei,
        ) = abi.decode(_minAmountOutAndOrderData, (uint256, bytes));

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
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes calldata /* _orderData */
    )
    external
    view
    returns (uint256) {
        if (_inputToken == PBTC && _outputToken == address(STBTC)) {
            return STBTC.previewDeposit(_desiredInputAmount);
        } else if (_inputToken == address(STBTC) && _outputToken == PBTC) {
            return STBTC.previewRedeem(_desiredInputAmount);
        } else {
            revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": Invalid trade")));
        }
    }
}
