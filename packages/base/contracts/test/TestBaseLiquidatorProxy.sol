// SPDX-License-Identifier: Apache 2.0
/*

    Copyright 2022 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { BaseLiquidatorProxy } from "../general/BaseLiquidatorProxy.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";


/**
 * @title   TestBaseLiquidatorProxy
 * @author  Dolomite
 *
 * Contract for testing BaseLiquidatorProxy
 */
contract TestBaseLiquidatorProxy is BaseLiquidatorProxy {

    // ============ Constructors ============

    constructor(
        address _liquidatorAssetRegistry,
        address _dolomiteMargin,
        address _expiry,
        uint256 _chainId
    )
    BaseLiquidatorProxy(
        _liquidatorAssetRegistry,
        _dolomiteMargin,
        _expiry,
        _chainId
    ) { /* solhint-disable-line no-empty-blocks */ }

    // ============ Internal Functions ============

    function initializeCache(
        LiquidatorProxyConstants memory _constants
    )
        public
        view
        returns (LiquidatorProxyCache memory)
    {
        return _initializeCache(_constants);
    }

    function checkConstants(
        LiquidatorProxyConstants memory _constants
    )
        public
        view
    {
        _checkConstants(_constants);
    }

    function checkBasicRequirements(
        LiquidatorProxyConstants memory _constants
    )
        public
        view
    {
        _checkBasicRequirements(_constants);
    }

    function getAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
        public
        view
        returns (
            IDolomiteMargin.MonetaryValue memory,
            IDolomiteMargin.MonetaryValue memory
        )
    {
        return _getAccountValues(
            _marketInfos,
            _account,
            _marketIds
        );
    }

    function getAdjustedAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
        public
        view
        returns (
            IDolomiteMargin.MonetaryValue memory,
            IDolomiteMargin.MonetaryValue memory
        )
    {
        return _getAdjustedAccountValues(
            _marketInfos,
            _account,
            _marketIds
        );
    }

    function getMarketInfos(
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    )
        public
        view
        returns (MarketInfo[] memory)
    {
        return _getMarketInfos(_solidMarketIds, _liquidMarketIds);
    }

    function calculateAndSetMaxLiquidationAmount(
        LiquidatorProxyCache memory _cache
    )
        public
        pure
        returns (LiquidatorProxyCache memory)
    {
        _calculateAndSetMaxLiquidationAmount(_cache);
        return _cache;
    }

    function calculateAndSetActualLiquidationAmount(
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        LiquidatorProxyCache memory _cache
    )
        public
        pure
        returns (LiquidatorProxyCache memory newCache, uint256 newInputAmountWei, uint256 newMinOutputAmountWei)
    {
        (newInputAmountWei, newMinOutputAmountWei) = _calculateAndSetActualLiquidationAmount(
            _inputAmountWei,
            _minOutputAmountWei,
            _cache
        );
        newCache = _cache;
    }

    function isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteMargin.Decimal memory _ratio
    )
        public
        pure
        returns (bool)
    {
        return _isCollateralized(_supplyValue, _borrowValue, _ratio);
    }
}
