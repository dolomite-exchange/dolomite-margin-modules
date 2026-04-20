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
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from  "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";


/**
 * @title   LiquidationTrader
 * @author  Dolomite
 * 
 * @dev     FOR ARBITRUM ONLY
 *
 * Contract for performing liquidations via an internal trader
 */
contract LiquidationTrader is OnlyDolomiteMargin, IDolomiteAutoTrader {
    using DecimalLib for uint256;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;

    // ============ Constants ============

    bytes32 private constant _FILE = "LiquidationTrader";

    address public handler;
    bool private _isHandler;

    // ============ Constructor ============

    constructor(address _handler, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        _ownerSetHandler(_handler);
    }

    // ============ Public Functions ============

    function ownerSetHandler(address _handler) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler);
    }

    function liquidate(
        IDolomiteStructs.AccountInfo memory solidAccount,
        IDolomiteStructs.AccountInfo memory liquidAccount
    ) external {
        Require.that(
            msg.sender == handler,
            _FILE,
            "Invalid msg.sender"
        );

        _isHandler = true; // set this to true so internal trade can occur

        // call to operate

        _isHandler = false;
    }


    /**
     * Allows traders to make trades approved by this smart contract. The active trader's account is
     * the takerAccount and the passive account (for which this contract approves trades
     * on-behalf-of) is the makerAccount.
     *
     * @param  _inputMarketId   The market for which the trader specified the original amount (debt market)
     * @param  _outputMarketId  The market for which the trader wants the resulting amount specified (collateral market)
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
        Require.that(
            _isHandler,
            _FILE,
            "Invalid caller"
        );

        // confirm that the maker account is underwater
        (
            IDolomiteStructs.MonetaryValue memory supply,
            IDolomiteStructs.MonetaryValue memory borrow
        ) = DOLOMITE_MARGIN().getAdjustedAccountValues(_makerAccount);
        IDolomiteStructs.Decimal memory requiredRatio = DOLOMITE_MARGIN().getMarginRatio();

        // @todo partial liquidation logic
        Require.that(
            supply.value >= borrow.value + borrow.value.mul(requiredRatio),
            _FILE,
            "Account is collateralized"
        );


        // get input (debt) and output (collateral) prices with liquidation spread
        IDolomiteStructs.Decimal memory spread = DOLOMITE_MARGIN().getLiquidationSpreadForPair(
            _outputMarketId,
            _inputMarketId
        );

        IDolomiteStructs.MonetaryPrice memory heldPrice = DOLOMITE_MARGIN().getMarketPrice(_outputMarketId);
        IDolomiteStructs.MonetaryPrice memory owedPrice = DOLOMITE_MARGIN().getMarketPrice(_inputMarketId);
        owedPrice.value = owedPrice.value + owedPrice.value.mul(spread);

        uint256 liquidHeldWei = DOLOMITE_MARGIN().getAccountWei(_makerAccount, _outputMarketId).value;
        uint256 liquidOwedWei = DOLOMITE_MARGIN().getAccountWei(_makerAccount, _inputMarketId).value;
        Require.that(
            _oldInputPar.isNegative() && !_newInputPar.isPositive(),
            _FILE,
            "Cannot over repay debt"
        );
        Require.that(
            _inputDeltaWei.isPositive() && _inputDeltaWei.value <= liquidOwedWei,
            _FILE,
            "Invalid input wei"
        );

        uint256 heldReward = _inputDeltaWei.value * owedPrice.value / heldPrice.value;
        Require.that(
            liquidHeldWei >= heldReward,
            _FILE,
            "Insufficient held wei"
        );

        // @todo emit Liquidation event

        return IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: heldReward
        });
    }

    function _ownerSetHandler(address _handler) internal {
        Require.that(
            _handler != address(0),
            _FILE,
            "Invalid handler"
        );

        handler = _handler;
        // @todo emit event
    }
}
