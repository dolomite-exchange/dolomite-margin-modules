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

import { IDolomiteAutoTrader } from "../../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IInternalAutoTraderBase
 * @author  Dolomite
 *
 * Base interface for performing internal trades
 */
interface IInternalAutoTraderBase is IDolomiteAutoTrader {

    // ========================================================
    // ================== Structs Functions ==================
    // ========================================================

    /**
     * Struct for internal trade parameters
     * 
     * @dev The maker account is the zap account of the person making the trade
     * 
     * @param makerAccount The maker account
     * @param makerAccountId The maker account ID
     * @param amount The amount of the trade
     * @param minOutputAmount The minimum output amount
     */
    struct InternalTradeParams {
        IDolomiteStructs.AccountInfo makerAccount;
        uint256 makerAccountId;
        uint256 amount;
        uint256 minOutputAmount;
    }

    /**
     * Struct for internal trader base storage
     * 
     * @param tradeEnabled Whether a trade is enabled
     * @param globalFee The global fee for a smart debt trade
     * @param adminFee The admin fee for a smart debt trade
     */
    struct InternalTraderBaseStorage {
        bool tradeEnabled;
        uint256 globalFee;
        uint256 adminFee;
    }

    /**
     * Struct for creating actions for an internal trade
     * 
     * @dev Maker and taker accounts are reversed in AccountActionLib.encodeInternalTradeActionWithWhitelistedTrader
     * 
     * @param takerAccountId The taker account ID
     * @param takerAccount The taker account (user making the trade)
     * @param feeAccountId The fee account ID
     * @param feeAccount The fee account
     * @param inputMarketId The input market ID
     * @param outputMarketId The output market ID
     * @param inputAmountWei The input amount in wei
     * @param trades The trades (contains the maker account / smart debt account for each trade)
     * @param extraData The extra data
     */
    struct CreateActionsForInternalTradeParams {
        uint256 takerAccountId;
        IDolomiteStructs.AccountInfo takerAccount;
        uint256 feeAccountId;
        IDolomiteStructs.AccountInfo feeAccount;
        uint256 inputMarketId;
        uint256 outputMarketId;
        uint256 inputAmountWei;
        InternalTradeParams[] trades;
        bytes extraData;
    }

    // ========================================================
    // ================== Events Functions ==================
    // ========================================================

    event GlobalFeeSet(uint256 indexed globalFee);
    event AdminFeeSet(uint256 indexed adminFee);
    event PairFeeSet(bytes32 indexed pairBytes, uint256 indexed fee);

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /**
     * Callback function for DolomiteMargin action. Sets tradeEnabled to true or false
     * 
     * @dev Only callable by a trusted internal trader caller
     * 
     * @param _sender The address of the sender
     * @param _accountInfo The account info
     * @param _data The encoded data
     */
    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) external;

    /**
     * Gets the trade cost for an internal trade. Called within a DolomiteMargin trade action
     * 
     * @param _inputMarketId The input market ID
     * @param _outputMarketId The output market ID
     * @param _makerAccount The maker account
     * @param _takerAccount The taker account
     * @param _oldInputPar The old input par
     * @param _newInputPar The new input par
     * @param _inputDeltaWei The input delta wei
     * @param _data The encoded data
     */
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory _makerAccount,
        IDolomiteStructs.AccountInfo memory _takerAccount,
        IDolomiteStructs.Par memory _oldInputPar,
        IDolomiteStructs.Par memory _newInputPar,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    ) external returns (IDolomiteStructs.AssetAmount memory);

    /**
     * Sets the global fee. Only callable by dolomite margin owner
     * 
     * @dev 1 ether = 100%
     * 
     * @param _globalFee The global fee
     */
    function ownerSetGlobalFee(uint256 _globalFee) external;

    /**
     * Sets the admin fee. Only callable by dolomite margin owner
     * 
     * @dev 1 ether = 100%
     * @dev Used as a percentage of the global fee
     * 
     * @param _adminFee The admin fee
     */
    function ownerSetAdminFee(uint256 _adminFee) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /**
     * Creates the actions for an internal trade
     * 
     * @param _params The struct with parameters for the internal trade(s)
     */
    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view returns (IDolomiteStructs.ActionArgs[] memory);

    /**
     * Returns the number of actions for a trade
     * 
     * @dev Calculated as number of trades + constant number of other actions
     * 
     * @param _trades List of internal trades
     * 
     * @return The number of actions
     */
    function actionsLength(InternalTradeParams[] calldata _trades) external view returns (uint256);

    /**
     * Returns the global fee for a trade
     * 
     * @return The global fee
     */
    function globalFee() external view returns (uint256);

    /**
     * Returns the admin fee for a trade
     * 
     * @return The admin fee
     */
    function adminFee() external view returns (uint256);

    /**
     * Returns whether the trade is enabled
     * 
     * @return Whether the trade is enabled
     */
    function tradeEnabled() external view returns (bool);
}
