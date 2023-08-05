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
 * @title   IParaswapAugustusRouter
 * @author  Dolomite
 *
 * @notice  Interface for executing trades via Paraswap
 */
interface IParaswapAugustusRouter {

    // ============= Structs =============

    struct Adapter {
        address payable adapter;
        uint256 percent;
        uint256 networkFee;
        Route[] route;
    }

    struct MegaSwapPath {
        uint256 fromAmountPercent;
        Path[] path;
    }

    struct MegaSwapSellData {
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address payable beneficiary;
        MegaSwapPath[] path;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct MultiSwapSellData {
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address payable beneficiary;
        Path[] path;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct Path {
        address to;
        uint256 totalNetworkFee; //Network fee is associated with 0xv3 trades
        Adapter[] adapters;
    }

    struct Route {
        uint256 index; //Adapter at which index needs to be used
        address targetExchange;
        uint percent;
        bytes payload;
        uint256 networkFee; //Network fee is associated with 0xv3 trades
    }

    struct SimpleSwapSellData {
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address[] callees;
        bytes exchangeData;
        uint256[] startIndexes;
        uint256[] values;
        address payable beneficiary;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    // ============ Functions ============

    function megaSwap(
        MegaSwapSellData calldata _data
    )
        external
        payable
        returns (uint256 receivedAmount);

    function multiSwap(
        MultiSwapSellData calldata _data
    )
        external
        payable
        returns (uint256 receivedAmount);

    function simpleSwap(
        SimpleSwapSellData calldata data
    )
        external
        payable
        returns (uint256 receivedAmount);
}
