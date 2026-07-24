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
interface IParaswapAugustusRouterV6 {

    // ============= Structs =============

    /// @notice Struct containing data for generic swapExactAmountIn/swapExactAmountOut
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount of destToken to receive
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param quotedAmount The quoted expected amount of destToken/srcToken
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    struct GenericData {
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
    }

    /*//////////////////////////////////////////////////////////////
                                UNISWAPV2
    //////////////////////////////////////////////////////////////*/

    /// @notice Struct for UniswapV2 swapExactAmountIn/swapExactAmountOut data
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param quotedAmount The quoted expected amount of destToken/srcToken
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount of destToken to receive
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    /// @param pools data consisting of concatenated token0 and token1 address for each pool with the direction flag being
    /// the right most bit of the packed token0-token1 pair bytes used in the path
    struct UniswapV2Data {
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
        bytes pools;
    }

    /*//////////////////////////////////////////////////////////////
                                UNISWAPV3
    //////////////////////////////////////////////////////////////*/

    /// @notice Struct for UniswapV3 swapExactAmountIn/swapExactAmountOut data
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param quotedAmount The quoted expected amount of destToken/srcToken
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount of destToken to receive
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    /// @param pools data consisting of concatenated token0-
    /// token1-fee bytes for each pool used in the path, with the direction flag being the left most bit of token0 in the
    /// concatenated bytes
    struct UniswapV3Data {
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
        bytes pools;
    }

/*//////////////////////////////////////////////////////////////
                            CURVE V1
//////////////////////////////////////////////////////////////*/

    /// @notice Struct for CurveV1 swapExactAmountIn data
    /// @param curveData Packed data for the Curve pool, first 160 bits is the target exchange address,
    /// the 161st bit is the approve flag, bits from (162 - 163) are used for the wrap flag,
    //// bits from (164 - 165) are used for the swapType flag and the last 91 bits are unused:
    /// Approve Flag - a) 0 -> do not approve b) 1 -> approve
    /// Wrap Flag - a) 0 -> do not wrap b) 1 -> wrap native & srcToken == eth
    /// c) 2 -> unwrap and destToken == eth d) 3 - >srcToken == eth && do not wrap
    /// Swap Type Flag -  a) 0 -> EXCHANGE b) 1 -> EXCHANGE_UNDERLYING
    /// @param curveAssets Packed uint128 index i and uint128 index j of the pool
    /// The first 128 bits is the index i and the second 128 bits is the index j
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount that must be recieved
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param quotedAmount The expected amount of destToken to be recieved
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    struct CurveV1Data {
        uint256 curveData;
        uint256 curveAssets;
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
    }

/*//////////////////////////////////////////////////////////////
                            CURVE V2
//////////////////////////////////////////////////////////////*/

    /// @notice Struct for CurveV2 swapExactAmountIn data
    /// @param curveData Packed data for the Curve pool, first 160 bits is the target exchange address,
    /// the 161st bit is the approve flag, bits from (162 - 163) are used for the wrap flag,
    //// bits from (164 - 165) are used for the swapType flag and the last 91 bits are unused
    /// Approve Flag - a) 0 -> do not approve b) 1 -> approve
    /// Approve Flag - a) 0 -> do not approve b) 1 -> approve
    /// Wrap Flag - a) 0 -> do not wrap b) 1 -> wrap native & srcToken == eth
    /// c) 2 -> unwrap and destToken == eth d) 3 - >srcToken == eth && do not wrap
    /// Swap Type Flag -  a) 0 -> EXCHANGE b) 1 -> EXCHANGE_UNDERLYING c) 2 -> EXCHANGE_UNDERLYING_FACTORY_ZAP
    /// @param i The index of the srcToken
    /// @param j The index of the destToken
    /// The first 128 bits is the index i and the second 128 bits is the index j
    /// @param poolAddress The address of the CurveV2 pool (only used for EXCHANGE_UNDERLYING_FACTORY_ZAP)
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount that must be recieved
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param quotedAmount The expected amount of destToken to be recieved
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    struct CurveV2Data {
        uint256 curveData;
        uint256 i;
        uint256 j;
        address poolAddress;
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
    }

    /*//////////////////////////////////////////////////////////////
                                BALANCER V2
    //////////////////////////////////////////////////////////////*/

    /// @notice Struct for BalancerV2 swapExactAmountIn data
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount of destToken to receive
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param quotedAmount The quoted expected amount of destToken/srcToken
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiaryAndApproveFlag The beneficiary address and approve flag packed into one uint256,
    /// the first 20 bytes are the beneficiary address and the left most bit is the approve flag
    struct BalancerV2Data {
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        uint256 beneficiaryAndApproveFlag;
    }

    // ============ Functions ============

    function swapExactAmountIn(
        address executor,
        GenericData calldata swapData,
        uint256 partnerAndFee,
        bytes calldata permit,
        bytes calldata executorData
    )
    external
    payable;

    function swapExactAmountInOnBalancerV2(
        BalancerV2Data calldata balancerData,
        uint256 partnerAndFee,
        bytes calldata permit,
        bytes calldata data
    )
    external
    payable
    returns (uint256 receivedAmount, uint256 paraswapShare, uint256 partnerShare);

    function swapExactAmountInOnCurveV1(
        CurveV1Data calldata curveV1Data,
        uint256 partnerAndFee,
        bytes calldata permit
    )
    external
    payable
    returns (uint256 receivedAmount, uint256 paraswapShare, uint256 partnerShare);

    function swapExactAmountInOnCurveV2(
        CurveV2Data calldata curveV2Data,
        uint256 partnerAndFee,
        bytes calldata permit
    )
    external
    payable
    returns (uint256 receivedAmount, uint256 paraswapShare, uint256 partnerShare);

    function swapExactAmountInOnUniswapV2(
        UniswapV2Data calldata uniData,
        uint256 partnerAndFee,
        bytes calldata permit
    )
    external
    payable
    returns (uint256 receivedAmount, uint256 paraswapShare, uint256 partnerShare);

    function swapExactAmountInOnUniswapV3(
        UniswapV3Data calldata uniData,
        uint256 partnerAndFee,
        bytes calldata permit
    )
    external
    payable
    returns (uint256 receivedAmount, uint256 paraswapShare, uint256 partnerShare);
}
