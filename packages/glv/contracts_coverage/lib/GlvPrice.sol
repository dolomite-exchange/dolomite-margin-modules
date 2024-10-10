// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

/**
 * @title   GlvPrice
 *
 * @notice  GlvPrice library from GMX
 */
library GlvPrice {
    // @param  min the min price
    // @param  max the max price
    struct Props {
        uint256 min;
        uint256 max;
    }
}
