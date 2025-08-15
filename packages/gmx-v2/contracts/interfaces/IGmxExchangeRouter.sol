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

import { IGmxDepositHandler } from "./IGmxDepositHandler.sol";
import { IGmxWithdrawalHandler } from "./IGmxWithdrawalHandler.sol";


/**
 * @title   IGmxExchangeRouter
 * @author  Dolomite
 *
 * @notice  Interface of the GMX Exchange Router contract
 */
interface IGmxExchangeRouter {

    struct CreateDepositParams {
        CreateDepositParamsAddresses addresses;
        uint256 minMarketTokens;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
        bytes32[] dataList;
    }

    struct CreateDepositParamsAddresses {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
    }

    struct CreateWithdrawalParams {
        CreateWithdrawalParamsAddresses addresses;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
        bytes32[] dataList;
    }

    struct CreateWithdrawalParamsAddresses {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
    }

    function createDeposit(CreateDepositParams calldata _params) external returns (bytes32);

    function createWithdrawal(CreateWithdrawalParams calldata _params) external returns (bytes32);

    function sendWnt(address _receiver, uint256 _amount) external payable;

    function sendTokens(address _token, address _receiver, uint256 _amount) external payable;

    function cancelDeposit(bytes32 _key) external payable;

    function cancelWithdrawal(bytes32 _key) external payable;

    function depositHandler() external view returns (IGmxDepositHandler);

    function withdrawalHandler() external view returns (IGmxWithdrawalHandler);
}
