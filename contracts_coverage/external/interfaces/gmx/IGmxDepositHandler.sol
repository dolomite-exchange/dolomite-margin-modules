// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;


/**
 * @title   IGmxDepositHandler
 * @author  Dolomite
 *
 */
interface IGmxDepositHandler {

    // @dev CreateDepositParams struct used in createDeposit to avoid stack
    // too deep errors
    //
    // @param  receiver the address to send the market tokens to
    // @param  callbackContract the callback contract
    // @param  uiFeeReceiver the ui fee receiver
    // @param  market the market to deposit into
    // @param  minMarketTokens the minimum acceptable number of liquidity tokens
    // @param  shouldUnwrapNativeToken whether to unwrap the native token when
    //         sending funds back to the user in case the deposit gets cancelled
    // @param  executionFee the execution fee for keepers
    // @param  callbackGasLimit the gas limit for the callbackContract
    struct CreateDepositParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minMarketTokens;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    struct Props {
        uint256 min;
        uint256 max;
    }

    struct SimulatePricesParams {
        address[] primaryTokens;
        Props[] primaryPrices;
    }

    struct SetPricesParams {
        uint256 signerInfo;
        address[] tokens;
        uint256[] compactedMinOracleBlockNumbers;
        uint256[] compactedMaxOracleBlockNumbers;
        uint256[] compactedOracleTimestamps;
        uint256[] compactedDecimals;
        uint256[] compactedMinPrices;
        uint256[] compactedMinPricesIndexes;
        uint256[] compactedMaxPrices;
        uint256[] compactedMaxPricesIndexes;
        bytes[] signatures;
        address[] priceFeedTokens;
    }

    function createDeposit(address _account, CreateDepositParams calldata _params) external returns (bytes32);

    function cancelDeposit(bytes32 _key) external;

    function simulateExecuteDeposit(bytes32 _key, SimulatePricesParams memory _params) external;

    function executeDeposit(bytes32 _key, SetPricesParams calldata _oracleParams) external;
}
