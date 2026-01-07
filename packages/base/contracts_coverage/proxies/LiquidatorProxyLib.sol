// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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
import { BitsLib } from "../protocol/lib/BitsLib.sol";
import { BaseLiquidatorProxy } from "./BaseLiquidatorProxy.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";


/**
 * @title   LiquidatorProxyLib
 * @author  Dolomite
 *
 * @notice  Library contract for reducing code size of the LiquidatorProxy contract
 */
library LiquidatorProxyLib {
    using TypesLib for IDolomiteMargin.Par;

    bytes32 private constant _FILE = "LiquidatorProxyLib";

    function checkConstants(
        IDolomiteMargin _dolomiteMargin,
        BaseLiquidatorProxy.LiquidatorProxyConstants memory _constants
    ) external view {
        // panic if the developer didn't set these variables already
        /*assert(_constants.solidAccount.owner != address(0));*/
        /*assert(_constants.liquidAccount.owner != address(0));*/

        if (_constants.owedMarket != _constants.heldMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.owedMarket != _constants.heldMarket,
            _FILE,
            "Owed market equals held market",
            _constants.owedMarket
        );

        if (!_dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !_dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive(),
            _FILE,
            "Owed market cannot be positive",
            _constants.owedMarket
        );

        if (_dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive(),
            _FILE,
            "Held market cannot be negative",
            _constants.heldMarket
        );

        if (uint32(_constants.expirationTimestamp) == _constants.expirationTimestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            uint32(_constants.expirationTimestamp) == _constants.expirationTimestamp,
            _FILE,
            "Expiration timestamp overflows",
            _constants.expirationTimestamp
        );

        if (_constants.expirationTimestamp <= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.expirationTimestamp <= block.timestamp,
            _FILE,
            "Borrow not yet expired",
            _constants.expirationTimestamp
        );
    }

    function checkBasicRequirements(
        IDolomiteMargin _dolomiteMargin,
        IExpiry _expiry,
        BaseLiquidatorProxy.LiquidatorProxyConstants memory _constants
    ) external view {
        if (_constants.solidAccount.owner == msg.sender || _dolomiteMargin.getIsLocalOperator(_constants.solidAccount.owner, msg.sender) || _dolomiteMargin.getIsGlobalOperator(msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.solidAccount.owner == msg.sender
                || _dolomiteMargin.getIsLocalOperator(_constants.solidAccount.owner, msg.sender)
                || _dolomiteMargin.getIsGlobalOperator(msg.sender),
            _FILE,
            "Sender not operator",
            msg.sender
        );

        if (_constants.expirationTimestamp != 0) {
            // check the expiration is valid
            uint32 expirationTimestamp = _expiry.getExpiry(_constants.liquidAccount, _constants.owedMarket);
            if (expirationTimestamp == _constants.expirationTimestamp) { /* FOR COVERAGE TESTING */ }
            Require.that(
                expirationTimestamp == _constants.expirationTimestamp,
                _FILE,
                "Expiration timestamp mismatch",
                expirationTimestamp,
                _constants.expirationTimestamp
            );
        }
    }


    function getMarketInfos(
        IDolomiteMargin _dolomiteMargin,
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) external view returns (BaseLiquidatorProxy.MarketInfo[] memory) {
        uint[] memory marketBitmaps = BitsLib.createBitmaps(_dolomiteMargin.getNumMarkets());
        uint256 marketsLength = 0;
        marketsLength = _addMarketsToBitmap(_solidMarketIds, marketBitmaps, marketsLength);
        marketsLength = _addMarketsToBitmap(_liquidMarketIds, marketBitmaps, marketsLength);

        uint256 counter = 0;
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = new BaseLiquidatorProxy.MarketInfo[](marketsLength);
        for (uint256 i; i < marketBitmaps.length && counter != marketsLength; ++i) {
            uint256 bitmap = marketBitmaps[i];
            while (bitmap != 0) {
                uint256 nextSetBit = BitsLib.getLeastSignificantBit(bitmap);
                uint256 marketId = BitsLib.getMarketIdFromBit(i, nextSetBit);

                marketInfos[counter++] = BaseLiquidatorProxy.MarketInfo({
                    marketId: marketId,
                    price: _dolomiteMargin.getMarketPrice(marketId),
                    index: _dolomiteMargin.getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
        }

        return marketInfos;
    }

    function _addMarketsToBitmap(
        uint256[] memory _markets,
        uint256[] memory _bitmaps,
        uint256 _marketsLength
    ) private pure returns (uint) {
        for (uint256 i; i < _markets.length; ++i) {
            if (!BitsLib.hasBit(_bitmaps, _markets[i])) {
                BitsLib.setBit(_bitmaps, _markets[i]);
                _marketsLength += 1;
            }
        }
        return _marketsLength;
    }

}
