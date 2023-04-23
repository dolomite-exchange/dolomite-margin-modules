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

import { OnlyDolomiteMargin } from "../external/helpers/OnlyDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestAdminPriceOracleV1
 * @author  Dolomite
 *
 * @notice  A simple implementation of IDolomitePriceOracle that allows the owner of DolomiteMargin to set the price.
 */
contract TestAdminPriceOracleV1 is IDolomitePriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "TestAdminPriceOracleV1";

    // ============================ Public State Variables ============================

    mapping(address => uint256) private _tokenToPriceMap;

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function ownerSetPrice(
        address _token,
        uint256 _price
    )
    public
    onlyDolomiteMarginOwner(msg.sender) {
        _tokenToPriceMap[_token] = _price;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        return IDolomiteStructs.MonetaryPrice({
            value: _tokenToPriceMap[_token]
        });
    }
}
