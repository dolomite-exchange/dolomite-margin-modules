// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { InternalSafeDelegateCallLib } from "../lib/InternalSafeDelegateCallLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { LiquidatorProxyLib } from "../proxies/LiquidatorProxyLib.sol";
import { LiquidatorProxyV6 } from "../proxies/LiquidatorProxyV6.sol";


/**
 * @title   TestLiquidatorProxyV6
 * @author  Dolomite
 *
 * @notice  Contract for testing the LiquidatorProxyV6
 */
contract TestLiquidatorProxyV6 is LiquidatorProxyV6 {
    using InternalSafeDelegateCallLib for address;

    constructor(
        uint256 _chainId,
        address _expiry,
        address _dolomiteMargin,
        address _dolomiteRegistry,
        address _liquidatorAssetRegistry,
        address _dolomiteAccountRiskOverride
    ) LiquidatorProxyV6(
        _chainId,
        _expiry,
        _dolomiteMargin,
        _dolomiteRegistry,
        _liquidatorAssetRegistry,
        _dolomiteAccountRiskOverride
    ) {}

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }

    function otherAccountId() external pure returns (uint256) {
        return _otherAccountId();
    }

    function isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteStructs.Decimal memory _ratio
    ) external pure returns (bool) {
        return _isCollateralized(_supplyValue, _borrowValue, _ratio);
    }

    function getAccountValues(
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        uint256[] memory _solidMarkets,
        uint256[] memory _liquidMarkets,
        bool _adjustForMarginPremiums,
        IDolomiteStructs.Decimal memory _marginRatioOverride
    ) external view returns (IDolomiteStructs.MonetaryValue memory, IDolomiteStructs.MonetaryValue memory) {
        if (_adjustForMarginPremiums) {
            return _getAdjustedAccountValues(
                LiquidatorProxyLib.getMarketInfos(DOLOMITE_MARGIN(), _solidMarkets, _liquidMarkets),
                _account,
                _marketIds,
                _marginRatioOverride
            );
        } else {
            return _getAccountValues(
                LiquidatorProxyLib.getMarketInfos(DOLOMITE_MARGIN(), _solidMarkets, _liquidMarkets),
                _account,
                _marketIds,
                _marginRatioOverride
            );
        }
    }

    function binarySearch(
        uint256[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) external view returns (MarketInfo memory) {
        return _binarySearch(
            LiquidatorProxyLib.getMarketInfos(DOLOMITE_MARGIN(), _markets, _markets),
            _beginInclusive,
            _endExclusive,
            _marketId
        );
    }
}
