// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite.

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

import { IGenericTraderBase } from "../../interfaces/IGenericTraderBase.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IExpiry } from "../../interfaces/IExpiry.sol";
import { IEventEmitterRegistry } from "../../interfaces/IEventEmitterRegistry.sol";


/**
 * @title   IGenericTraderProxyV2
 * @author  Dolomite
 *
 * Trader router interface for trading assets using any trader from msg.sender
 */
interface IGenericTraderProxyV2 is IGenericTraderBase {

    // ============ Structs ============

    enum EventEmissionType {
        None,
        BorrowPosition,
        MarginPosition
    }

    struct TransferAmount {
        /// @dev The market ID to transfer
        uint256 marketId;
        /// @dev Note, setting to uint(-1) will transfer all of the user's balance.
        uint256 amountWei;
    }

    struct TransferCollateralParam {
        /// @dev The account number from which collateral will be transferred.
        uint256 fromAccountNumber;
        /// @dev The account number to which collateral will be transferred.
        uint256 toAccountNumber;
        /// @dev The transfers to execute after all of the trades.
        TransferAmount[] transferAmounts;
    }

    struct ExpiryParam {
        /// @dev The market ID whose expiry will be updated.
        uint256 marketId;
        /// @dev The new expiry time delta for the market. Setting this to `0` will reset the expiration.
        uint32 expiryTimeDelta;
    }

    struct UserConfig {
        /// @dev The timestamp at which the zap request fails
        uint256 deadline;
        /// @dev    Setting this to `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` will check the
        ///         `_tradeAccountNumber` is not negative after the trade for the input market (_marketIdsPath[0]).
        ///         Setting this to `BalanceCheckFlag.Both` or `BalanceCheckFlag.To` will check the
        ///         `_transferAccountNumber` is not negative after the trade for any of the transfers in
        ///         `TransferCollateralParam.transferAmounts`.
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag;
        EventEmissionType eventType;
    }

    /**
     *
     * @param  _accountNumber               The account number to use for msg.sender's trade
     * @param  _marketIdsPath               The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param  _inputAmountWei              The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param  _minOutputAmountWei          The minimum output amount expected to be received by the user.
     * @param  _tradersPath                 The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1`.
     * @param  _makerAccounts               The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     * @param  _userConfig                  The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's `_tradeAccountNumber`
     *                                      is non-negative after the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.To` has no effect.
     */
    struct SwapExactInputForOutputParams {
        uint256 accountNumber;
        uint256[] marketIdsPath;
        uint256 inputAmountWei;
        uint256 minOutputAmountWei;
        TraderParam[] tradersPath;
        IDolomiteMargin.AccountInfo[] makerAccounts;
        UserConfig userConfig;
    }

    /**
     *
     * @param  _accountNumber               The account number to use for msg.sender's trade
     * @param  _marketIdsPath               The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param  _inputAmountWei              The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param  _minOutputAmountWei          The minimum output amount expected to be received by the user.
     * @param  _tradersPath                 The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1`.
     * @param  _makerAccounts               The accounts that will be used for the maker side of the trades involving
                                            `TraderType.InternalLiquidity`.
     * @param  _transferCollateralParams    The parameters for transferring collateral in/out of the
     *                                      `_accountNumber` once the trades settle. One of
     *                                      `_params.fromAccountNumber` or `_params.toAccountNumber` must be equal to
     *                                      `_accountNumber`.
     * @param  _expiryParams                The parameters for modifying the expiration of the debt in the position.
     * @param  _userConfig                  The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's balance for inputMarket
     *                                      for `_tradeAccountNumber` is non-negative after the trade. Setting the
     *                                      `balanceCheckFlag` to `BalanceCheckFlag.To` will check that the user's
     *                                      balance for each `transferMarket` for `transferAccountNumber` is
     *                                      non-negative after.
     */
    struct SwapExactInputForOutputAndModifyPositionParams {
        uint256 accountNumber;
        uint256[] marketIdsPath;
        uint256 inputAmountWei;
        uint256 minOutputAmountWei;
        TraderParam[] tradersPath;
        IDolomiteStructs.AccountInfo[] makerAccounts;
        TransferCollateralParam transferCollateralParams;
        ExpiryParam expiryParams;
        UserConfig userConfig;
    }

    /**
     * @dev     Swaps an exact amount of input for a minimum amount of output.
     *
     */
    function swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
    external;

    /**
     * @dev     Swaps an exact amount of input for a minimum amount of output.
     *
     */
    function swapExactInputForOutputForDifferentAccount(
        address _accountOwner,
        SwapExactInputForOutputParams memory _params
    )
    external;


    function swapExactInputForOutputAndModifyPositionForDifferentAccount(
        address tradeAccountOwner,
        SwapExactInputForOutputAndModifyPositionParams memory params
    ) external;


    function swapExactInputForOutputAndModifyPosition(
        SwapExactInputForOutputAndModifyPositionParams memory _params
    )
    external;
}
