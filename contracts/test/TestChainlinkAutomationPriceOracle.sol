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

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./ICustomTestVaultToken.sol";

import "../external/oracles/ChainlinkAutomationPriceOracle.sol";

import "hardhat/console.sol";

/**
 * @title   TestChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  This contract is used to test the ChainlinkAutomationPriceOracle.sol contract.
 */
contract TestChainlinkAutomationPriceOracle is ChainlinkAutomationPriceOracle {

    ICustomTestVaultToken public TOKEN;
    uint256 public MARKET_ID;

    constructor(address _dolomiteMargin, address _chainlinkRegistry, address _token, uint256 _marketId) ChainlinkAutomationPriceOracle(_dolomiteMargin, _chainlinkRegistry) {
        TOKEN = ICustomTestVaultToken(_token);
        MARKET_ID = _marketId;

        _updateExchangeRateAndTimestamp();
    }

    function getPrice(address _token) external view returns (IDolomiteStructs.MonetaryPrice memory) {

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    function _getExchangeRate() internal override view returns (uint256, uint256) {
        return (TOKEN.totalAssets(), TOKEN.totalSupply());
    }

    function _getCurrentPrice() internal override view returns (uint256) {
        return DOLOMITE_MARGIN().getMarketPrice(MARKET_ID).value;
    }
}
