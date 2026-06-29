// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import { IPancakeV3Pair } from "../interfaces/IPancakeV3Pair.sol";

contract TestPancakeV3Pair is IPancakeV3Pair {
    address public token0;
    address public token1;
    int56[] private _tickCumulatives;

    function setTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }

    function setTickCumulatives(int56[] calldata tickCumulatives) external {
        _tickCumulatives = tickCumulatives;
    }

    function observe(uint32[] calldata /* secondsAgo */)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        return (_tickCumulatives, new uint160[](_tickCumulatives.length));
    }

    function getTimepoints(uint32[] calldata /* secondsAgos */)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulatives,
            uint112[] memory volatilityCumulatives,
            uint256[] memory volumePerAvgLiquiditys
        )
    {
        return (
            _tickCumulatives,
            new uint160[](_tickCumulatives.length),
            new uint112[](_tickCumulatives.length),
            new uint256[](_tickCumulatives.length)
        );
    }
}
