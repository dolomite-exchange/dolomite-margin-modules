// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite.

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
import { IOdosRouter } from "../interfaces/traders/IOdosRouter.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from  "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   LiquidationTrader
 * @author  Dolomite
 * @dev     FOR ARBITRUM ONLY
 *
 * Contract for performing liquidations via an internal trader
 */
contract LiquidationTrader is OnlyDolomiteMargin, IDolomiteAutoTrader {

    // ============ Constants ============

    bytes32 private constant _FILE = "LiquidationTrader";

    address public internalTradeLiquidatorProxy;
    bool public validCaller;

    // ============ Constructor ============

    constructor(address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
    }

    // ============ Public Functions ============

    function ownerSetInternalTradeLiquidatorProxy(address _proxy) external onlyDolomiteMarginOwner(msg.sender) {

    }

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo memory /* account */,
        bytes memory /* data */
    ) external onlyDolomiteMargin(msg.sender) {
        Require.that(
            _sender == internalTradeLiquidatorProxy,
            _FILE,
            "Invalid sender"
        );
        validCaller = true;
    }

    /**
     * Allows traders to make trades approved by this smart contract. The active trader's account is
     * the takerAccount and the passive account (for which this contract approves trades
     * on-behalf-of) is the makerAccount.
     *
     * @param  _inputMarketId   The market for which the trader specified the original amount
     * @param  _outputMarketId  The market for which the trader wants the resulting amount specified
     * @param  _makerAccount    The account for which this contract is making trades
     * @param  _takerAccount    The account requesting the trade
     * @param  _oldInputPar     The old principal amount for the makerAccount for the inputMarketId
     * @param  _newInputPar     The new principal amount for the makerAccount for the inputMarketId
     * @param  _inputDeltaWei   The change in token amount for the makerAccount for the inputMarketId
     * @param  _data            Arbitrary data passed in by the trader
     * @return                  The AssetAmount for the makerAccount for the outputMarketId
     */
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo calldata _makerAccount,
        IDolomiteStructs.AccountInfo calldata _takerAccount,
        IDolomiteStructs.Par calldata _oldInputPar,
        IDolomiteStructs.Par calldata _newInputPar,
        IDolomiteStructs.Wei calldata _inputDeltaWei,
        bytes calldata _data
    ) external onlyDolomiteMargin(msg.sender) returns (IDolomiteStructs.AssetAmount memory) {

        // confirm that the maker account is underwater

        // get input (debt) and output (collateral) prices with liquidation spread

        // do the trade

        // reset validCaller
        validCaller = false;
    }
}
