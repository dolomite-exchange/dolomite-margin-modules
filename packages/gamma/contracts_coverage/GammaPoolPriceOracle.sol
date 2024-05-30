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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IDeltaSwapFactory } from "./interfaces/IDeltaSwapFactory.sol";
import { IDeltaSwapPair } from "./interfaces/IDeltaSwapPair.sol";
import { IGammaPool } from "./interfaces/IGammaPool.sol";
import { IGammaPoolPriceOracle } from "./interfaces/IGammaPoolPriceOracle.sol";
import { IGammaRegistry } from "./interfaces/IGammaRegistry.sol";


/**
 * @title   GammaPoolPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets a Gamma pool's token price in USD
 */
contract GammaPoolPriceOracle is IGammaPoolPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GammaPoolPriceOracle";
    uint256 private constant _ONE = 1e18;

    // ============================ Public State Variables ============================

    IGammaRegistry public immutable REGISTRY; // solhint-disable-line var-name-mixedcase

    mapping(address => bool) public gammaPools;

    // ============================ Constructor ============================

    constructor(
        address _gammaRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        REGISTRY = IGammaRegistry(_gammaRegistry);
    }

    function ownerSetGammaPool(
        address _pool,
        bool _status
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGammaPool(_pool, _status);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            gammaPools[_token],
            _FILE,
            "Invalid token",
            _token
        );

        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "gammaPool cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice(_token)
        });
    }

    // ============================ Internal Functions ============================

    function _ownerSetGammaPool(address _pool, bool _status) internal {
        IGammaPool pool = IGammaPool(IIsolationModeVaultFactory(_pool).UNDERLYING_TOKEN());
        address pair = pool.cfmm();
        Require.that(
            IERC20Metadata(pair).decimals() == 18,
            _FILE,
            "Invalid pool decimals"
        );
        gammaPools[_pool] = _status;
        emit GammaPoolSet(_pool, _status);
    }

    function _getCurrentPrice(address _token) internal view returns (uint256) {
        IGammaPool pool = IGammaPool(IIsolationModeVaultFactory(_token).UNDERLYING_TOKEN());
        IDeltaSwapPair pair = IDeltaSwapPair(pool.cfmm());
        address token0 = pair.token0();
        address token1 = pair.token1();
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();

        IDolomitePriceOracle oracleAggregator = REGISTRY.dolomiteRegistry().oracleAggregator();
        uint256 usdPrice0 = oracleAggregator.getPrice(token0).value * reserve0 / _ONE;
        uint256 usdPrice1 = oracleAggregator.getPrice(token1).value * reserve1 / _ONE;

        return _getWeightedGeometricMean(usdPrice0, usdPrice1, _getTotalSupplyAtWithrawal(pair));
        // @follow-up Should we do exactly what aave did with the deviation?
        // return _getArithmeticMean(usdPrice0, usdPrice1, totalSupply);
    }

    // function _getArithmeticMean(uint256 _total0, uint256 _total1, uint256 _supply) internal pure returns (uint256) {
    //     return (_total0 + _total1) / _supply;
    // }

    function _getWeightedGeometricMean(
        uint256 _total0,
        uint256 _total1,
        uint256 _supply
    ) internal pure returns (uint256) {
        uint256 sqrt = Math.sqrt(_total0 * _total1);
        return sqrt * 2 * _ONE / _supply;
    }

    function _getTotalSupplyAtWithrawal(IDeltaSwapPair _pair) internal view returns (uint256) {
        uint256 totalSupply = _pair.totalSupply();
        (address feeTo, uint256 feeNum) = IDeltaSwapFactory(_pair.factory()).feeInfo();
        bool feeOn = feeTo != address(0);
        if (feeOn) {
            uint256 kLast = _pair.kLast();
            if (kLast != 0) {
                (uint112 reserve0, uint112 reserve1, ) = _pair.getReserves();
                uint256 rootK = Math.sqrt(uint256(reserve0) * uint256(reserve1));
                uint256 rootKLast = Math.sqrt(kLast);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply * (rootK - rootKLast);
                    uint256 denominator = rootK * feeNum / 1000 + rootKLast;
                    uint256 liquidity = numerator / denominator;
                    totalSupply = totalSupply + liquidity;
                }
            }
        }
        return totalSupply;
    }
}
