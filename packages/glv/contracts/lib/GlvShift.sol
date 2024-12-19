// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

/**
 * @title   GlvShift
 *
 * @notice  GlvShift library from GMX
 */
library GlvShift {
    struct Props {
        Addresses addresses;
        Numbers numbers;
    }

    struct Addresses {
        address glv;
        address fromMarket;
        address toMarket;
    }

    struct Numbers {
        uint256 marketTokenAmount;
        uint256 minMarketTokens;
        uint256 updatedAtTime;
    }
}
