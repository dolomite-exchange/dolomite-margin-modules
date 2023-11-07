// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.9;

import { FullMath } from "./FullMath.sol";
import { TickMath } from "./TickMath.sol";
import { IAlgebraV3Pool } from "../external/interfaces/camelot/IAlgebraV3Pool.sol";


/**
 * @title   OracleLibrary
 *
 */
library OracleLibrary {

    function consult(address _pool, uint32 _period) internal view returns (int24 timeWeightedAverageTick) {
        require(_period != 0); // solhint-disable-line reason-string

        uint32[] memory secondAgos = new uint32[](2);
        secondAgos[0] = _period;
        secondAgos[1] = 0;

        (int56[] memory tickCumulatives, , ,) = IAlgebraV3Pool(_pool).getTimepoints(secondAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        timeWeightedAverageTick = int24(tickCumulativesDelta / int32(_period));

        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int32(_period) != 0)) timeWeightedAverageTick--;
    }

    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }

}
