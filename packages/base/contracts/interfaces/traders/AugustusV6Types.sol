// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*//////////////////////////////////////////////////////////////
                        GENERIC SWAP DATA
//////////////////////////////////////////////////////////////*/

/// @notice Struct containg data for generic swapExactAmountIn/swapExactAmountOut
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
    IERC20 srcToken;
    IERC20 destToken;
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
    IERC20 srcToken;
    IERC20 destToken;
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
    IERC20 srcToken;
    IERC20 destToken;
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
    IERC20 srcToken;
    IERC20 destToken;
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
    IERC20 srcToken;
    IERC20 destToken;
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

/*//////////////////////////////////////////////////////////////
                            MAKERPSM
//////////////////////////////////////////////////////////////*/

/// @notice Struct for Maker PSM swapExactAmountIn data
/// @param srcToken The token to swap from
/// @param destToken The token to swap to
/// @param fromAmount The amount of srcToken to swap
/// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
/// @param toAmount The minimum amount of destToken to receive
/// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
/// @param toll Used to calculate gem amount for the swapExactAmountIn
/// @param to18ConversionFactor Used to calculate gem amount for the swapExactAmountIn
/// @param gemJoinAddress The address of the gemJoin contract
/// @param exchange The address of the exchange contract
/// @param metadata Packed uuid and additional metadata
/// @param beneficiaryDirectionApproveFlag The beneficiary address, swap direction and approve flag packed
/// into one uint256, the first 20 bytes are the beneficiary address, the left most bit is the approve flag and the
/// second left most bit is the swap direction flag, 0 for swapExactAmountIn and 1 for swapExactAmountOut
struct MakerPSMData {
    IERC20 srcToken;
    IERC20 destToken;
    uint256 fromAmount;
    uint256 toAmount;
    uint256 toll;
    uint256 to18ConversionFactor;
    address exchange;
    address gemJoinAddress;
    bytes32 metadata;
    uint256 beneficiaryDirectionApproveFlag;
}

/*//////////////////////////////////////////////////////////////
                            AUGUSTUS RFQ
//////////////////////////////////////////////////////////////*/

/// @notice Order struct for Augustus RFQ
/// @param nonceAndMeta The nonce and meta data packed into one uint256,
/// the first 160 bits is the user address and the last 96 bits is the nonce
/// @param expiry The expiry of the order
/// @param makerAsset The address of the maker asset
/// @param takerAsset The address of the taker asset
/// @param maker The address of the maker
/// @param taker The address of the taker, if the taker is address(0) anyone can take the order
/// @param makerAmount The amount of makerAsset
/// @param takerAmount The amount of takerAsset
struct Order {
    uint256 nonceAndMeta;
    uint128 expiry;
    address makerAsset;
    address takerAsset;
    address maker;
    address taker;
    uint256 makerAmount;
    uint256 takerAmount;
}

/// @notice Struct containing order info for Augustus RFQ
/// @param order The order struct
/// @param signature The signature for the order
/// @param takerTokenFillAmount The amount of takerToken to fill
/// @param permitTakerAsset The permit data for the taker asset
/// @param permitMakerAsset The permit data for the maker asset
struct OrderInfo {
    Order order;
    bytes signature;
    uint256 takerTokenFillAmount;
    bytes permitTakerAsset;
    bytes permitMakerAsset;
}

/// @notice Struct containing common data for executing swaps on Augustus RFQ
/// @param fromAmount The amount of srcToken to swap
/// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
/// @param toAmount The minimum amount of destToken to receive
/// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
/// @param wrapApproveDirection The wrap, approve and direction flag packed into one uint8,
/// the first 2 bits is wrap flag (10 for wrap dest, 01 for wrap src, 00 for no wrap), the next bit is the approve flag
/// (1 for approve, 0 for no approve) and the last bit is the direction flag (0 for swapExactAmountIn and 1 for
/// swapExactAmountOut)
/// @param metadata Packed uuid and additional metadata
struct AugustusRFQData {
    uint256 fromAmount;
    uint256 toAmount;
    uint8 wrapApproveDirection;
    bytes32 metadata;
    address payable beneficiary;
}
