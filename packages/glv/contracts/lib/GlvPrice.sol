// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

// @title Price
// @dev Struct for prices
library GlvPrice {
    // @param min the min price
    // @param max the max price
    struct Props {
        uint256 min;
        uint256 max;
    }
}
