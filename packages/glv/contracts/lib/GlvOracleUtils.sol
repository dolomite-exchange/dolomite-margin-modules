// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GlvPrice } from "./GlvPrice.sol";

/**
 * @title   GlvOracleUtils
 *
 * @notice  GlvOracleUtils library from GMX
 */
library GlvOracleUtils {

    struct SetPricesParams {
        address[] tokens;
        address[] providers;
        bytes[] data;
    }

    struct ValidatedPrice {
        address token;
        uint256 min;
        uint256 max;
        uint256 timestamp;
        address provider;
    }

    struct SimulatePricesParams {
        address[] primaryTokens;
        GlvPrice.Props[] primaryPrices;
        uint256 minTimestamp;
        uint256 maxTimestamp;
    }
}
