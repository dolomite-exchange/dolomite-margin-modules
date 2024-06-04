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

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IDolomiteInterestSetter } from "../protocol/interfaces/IDolomiteInterestSetter.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";


/**
 * @title   SafeGettersForDolomiteMargin
 * @author  Dolomite
 *
 * @notice  Contract for getting data from DolomiteMargin without reverting
 */
contract SafeGettersForDolomiteMargin {
    using DecimalLib for uint256;
    using DolomiteMarginMath for uint256;

    // ============ Constants ============

    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ============ Storage ============

    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ Public Functions ============

    /**
     *
     * @param  _token   The token to get the market ID for
     * @return          The market ID for the given token or type(uint256).max if the token is not a valid market
     */
    function getMarketIdByTokenAddress(address _token) public view returns (uint256) {
        try DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token) returns (uint256 marketId) {
            return marketId;
        } catch {
            return type(uint256).max;
        }
    }

    function getMarketBorrowInterestRateApr(
        address _token
    ) public view returns (IDolomiteInterestSetter.InterestRate memory) {
        uint256 marketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token);
        return _getMarketBorrowInterestRateApr(marketId);
    }

    function getMarketSupplyInterestRateApr(
        address _token
    ) public view returns (IDolomiteInterestSetter.InterestRate memory) {
        uint256 marketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token);

        IDolomiteStructs.TotalPar memory totalPar = DOLOMITE_MARGIN.getMarketTotalPar(marketId);
        if (totalPar.supply == 0) {
            return IDolomiteInterestSetter.InterestRate({
                value: 0
            });
        }

        IDolomiteStructs.InterestIndex memory index = DOLOMITE_MARGIN.getMarketCurrentIndex(marketId);
        uint256 totalSupplyWei = InterestIndexLib.parToWei(
            IDolomiteStructs.Par({
                sign: true,
                value: totalPar.supply
            }),
            index
        ).value;
        uint256 totalBorrowWei = InterestIndexLib.parToWei(
            IDolomiteStructs.Par({
                sign: false,
                value: totalPar.borrow
            }),
            index
        ).value;

        IDolomiteInterestSetter.InterestRate memory borrowRate = _getMarketBorrowInterestRateApr(marketId);
        IDolomiteStructs.Decimal memory earningsRate = DOLOMITE_MARGIN.getEarningsRate();

        uint256 supplyRate = borrowRate.value.mul(earningsRate);
        if (totalBorrowWei < totalSupplyWei) {
            // Scale down the interest by the amount being supplied. Why? Because interest is only being paid on
            // the totalBorrowWei, which means it's split amongst all of the totalSupplyWei. Scaling it down normalizes
            // it for the suppliers to share what's being paid by borrowers
            supplyRate = supplyRate.getPartial(totalBorrowWei, totalSupplyWei);
        }

        return IDolomiteInterestSetter.InterestRate({
            value: supplyRate
        });
    }

    // ============ Private Functions ============

    function _getMarketBorrowInterestRateApr(
        uint256 _marketId
    ) private view returns (IDolomiteInterestSetter.InterestRate memory) {
        return IDolomiteInterestSetter.InterestRate({
            value: DOLOMITE_MARGIN.getMarketInterestRate(_marketId).value * SECONDS_PER_YEAR
        });
    }
}
