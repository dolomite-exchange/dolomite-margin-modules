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

import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IPendlePtPriceOracle } from "./interfaces/IPendlePtPriceOracle.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IPendleRegistry } from "./interfaces/IPendleRegistry.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";


/**
 * @title   PendlePtPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IPendlePtPriceOracle interface that gets Pendle's pt price in USD terms.
 */
contract PendlePtPriceOracle is IPendlePtPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtPriceOracle";
    uint32 public constant TWAP_DURATION = 900; // 15 minutes
    uint256 public constant DEDUCTION_COEFFICIENT_BASE = 1e18;

    // ============================ Public State Variables ============================

    address immutable public DPT_TOKEN; // solhint-disable-line var-name-mixedcase
    IPendleRegistry immutable public REGISTRY; // solhint-disable-line var-name-mixedcase
    address immutable public UNDERLYING_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public PT_ASSET_SCALE; // solhint-disable-line var-name-mixedcase
    uint256 public deductionCoefficient;

    // ============================ Constructor ============================

    constructor(
        address _dptToken,
        address _pendleRegistry,
        address _underlyingToken,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DPT_TOKEN = _dptToken;
        REGISTRY = IPendleRegistry(_pendleRegistry);
        UNDERLYING_TOKEN = _underlyingToken;
        PT_ASSET_SCALE = uint256(10) ** uint256(IERC20Metadata(DPT_TOKEN).decimals());
        _ownerSetDeductionCoefficient(0);

        (
            bool increaseCardinalityRequired,,
            bool oldestObservationSatisfied
        ) = REGISTRY.ptOracle().getOracleState(address(REGISTRY.ptMarket()), TWAP_DURATION);

        Require.that(
            !increaseCardinalityRequired && oldestObservationSatisfied,
            _FILE,
            "Oracle not ready yet"
        );
    }

    function ownerSetDeductionCoefficient(uint256 _deductionCoefficient) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDeductionCoefficient(_deductionCoefficient);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(DPT_TOKEN),
            _FILE,
            "invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "PT cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _applyDeductionCoefficient(uint256 _price) internal view returns (uint256) {
        return _price * (DEDUCTION_COEFFICIENT_BASE - deductionCoefficient) / DEDUCTION_COEFFICIENT_BASE;
    }

    function _ownerSetDeductionCoefficient(uint256 _deductionCoefficient) internal {
        deductionCoefficient = _deductionCoefficient;
        emit DeductionCoefficientSet(_deductionCoefficient);
    }

    function _getCurrentPrice() internal view virtual returns (uint256) {
        uint256 underlyingPrice = REGISTRY.dolomiteRegistry().chainlinkPriceOracle().getPrice(UNDERLYING_TOKEN).value;
        underlyingPrice = _applyDeductionCoefficient(underlyingPrice);

        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptMarket()), TWAP_DURATION);
        return underlyingPrice * ptExchangeRate / PT_ASSET_SCALE;
    }
}
