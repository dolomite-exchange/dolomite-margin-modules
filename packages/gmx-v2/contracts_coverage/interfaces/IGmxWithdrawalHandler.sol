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

import { GmxOracleUtils } from "../lib/GmxOracleUtils.sol";

/**
 * @title   IGmxWithdrawalHandler
 * @author  Dolomite
 *
 */
interface IGmxWithdrawalHandler {

    /**
     *
     * @param  receiver                 The address that will receive the withdrawal tokens.
     * @param  callbackContract         The contract that will be called back.
     * @param  market                   The market on which the withdrawal will be executed.
     * @param  minLongTokenAmount       The minimum amount of long tokens that must be withdrawn.
     * @param  minShortTokenAmount      The minimum amount of short tokens that must be withdrawn.
     * @param  shouldUnwrapNativeToken  Whether the native token should be unwrapped when executing the withdrawal.
     * @param  executionFee             The execution fee for the withdrawal.
     * @param  callbackGasLimit         The gas limit for calling the callback contract.
     */
    struct CreateWithdrawalParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
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

    error InsufficientWntAmount(uint256 wntAmount, uint256 executionFee);

    function createWithdrawal(address _account, CreateWithdrawalParams calldata _params) external returns (bytes32);

    function cancelWithdrawal(bytes32 _key) external;

    function simulateExecuteWithdrawal(bytes32 _key, SimulatePricesParams memory _params) external;

    function executeWithdrawal(
        bytes32 key,
        GmxOracleUtils.SetPricesParams calldata oracleParams
    ) external;
}
