// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

/**
 * @title   GlvPosition
 *
 * @notice  GlvPosition library from GMX
 */
library GlvPosition {
    // @dev there is a limit on the number of fields a struct can have when being passed
    // or returned as a memory variable which can cause "Stack too deep" errors
    // use sub-structs to avoid this issue
    // @param  addresses address values
    // @param  numbers number values
    // @param  flags boolean values
    struct Props {
        Addresses addresses;
        Numbers numbers;
        Flags flags;
    }

    // @param  account the position's account
    // @param  market the position's market
    // @param  collateralToken the position's collateralToken
    struct Addresses {
        address account;
        address market;
        address collateralToken;
    }

    // @param  sizeInUsd the position's size in USD
    // @param  sizeInTokens the position's size in tokens
    // @param  collateralAmount the amount of collateralToken for collateral
    // @param  borrowingFactor the position's borrowing factor
    // @param  fundingFeeAmountPerSize the position's funding fee per size
    // @param  longTokenClaimableFundingAmountPerSize the position's claimable funding amount per size
    // for the market.longToken
    // @param  shortTokenClaimableFundingAmountPerSize the position's claimable funding amount per size
    // for the market.shortToken
    // @param  increasedAtBlock the block at which the position was last increased
    // @param  decreasedAtBlock the block at which the position was last decreased
    struct Numbers {
        uint256 sizeInUsd;
        uint256 sizeInTokens;
        uint256 collateralAmount;
        uint256 borrowingFactor;
        uint256 fundingFeeAmountPerSize;
        uint256 longTokenClaimableFundingAmountPerSize;
        uint256 shortTokenClaimableFundingAmountPerSize;
        uint256 increasedAtBlock;
        uint256 decreasedAtBlock;
        uint256 increasedAtTime;
        uint256 decreasedAtTime;
    }

    // @param  isLong whether the position is a long or short
    struct Flags {
        bool isLong;
    }
}
