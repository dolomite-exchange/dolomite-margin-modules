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
 * @title   IOkxAggregator
 * @author  Dolomite
 *
 * @notice  Interface for executing trades via Okx
 */
interface IOkxAggregator {

    struct PMMSwapRequest {
        uint256 pathIndex;
        address payer;
        address fromToken;
        address toToken;
        uint256 fromTokenAmountMax;
        uint256 toTokenAmountMax;
        uint256 salt;
        uint256 deadline;
        bool isPushOrder;
        bytes extension;
    }

    struct PMMBaseRequest {
        uint256 fromTokenAmount;
        uint256 minReturnAmount;
        uint256 deadline;
        bool fromNative;
        bool toNative;
    }

    struct DexBaseRequest {
        uint256 fromToken;
        address toToken;
        uint256 fromTokenAmount;
        uint256 minReturnAmount;
        uint256 deadLine;
    }

    struct DexRouterPath {
        address[] mixAdapters;
        address[] assetTo;
        uint256[] rawData;
        bytes[] extraData;
        uint256 fromToken;
    }

    function PMMV2Swap(
        uint256 orderId,
        PMMBaseRequest calldata baseRequest,
        PMMSwapRequest calldata request
    ) external returns (uint256 returnAmount);

    function PMMV2SwapByInvest(
        address receiver,
        PMMBaseRequest calldata baseRequest,
        PMMSwapRequest calldata request
    ) external returns (uint256 returnAmount);

    function smartSwapByInvest(
        DexBaseRequest calldata baseRequest,
        uint256[] calldata batchesAmount,
        DexRouterPath[][] calldata batches,
        PMMSwapRequest[] calldata extraData,
        address to
    ) external returns (uint256 returnAmount);

    function smartSwapByOrderId(
        uint256 orderId,
        DexBaseRequest calldata baseRequest,
        uint256[] calldata batchesAmount,
        DexRouterPath[][] calldata batches,
        PMMSwapRequest[] calldata extraData
    ) external returns (uint256 returnAmount);

    // @follow-up I don't think we need these two commented ones and I removed all the XBridge ones
    // function swapWrap(
    //     uint256 orderId,
    //     uint256 rawdata
    // ) external;

    function uniswapV3SwapTo(
        uint256 recipient,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external returns (uint256 returnAmount);

    // function uniswapV3SwapToWithPermit(
    //     uint256 recipient,
    //     address srcToken,
    //     uint256 amount,
    //     uint256 minReturn,
    //     uint256[] calldata pools,
    //     bytes calldata permit
    // ) external returns (uint256 returnAmount);

    function unxswapByOrderId(
        uint256 srcToken,
        uint256 amount,
        uint256 minReturn,
        bytes32[] calldata pools
    ) external returns (uint256 returnAmount);
}
