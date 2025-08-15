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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestOracleProvider
 * @author  Dolomite
 *
 * @notice  Test oracle provider to be used with GMX V2 tests
 */
contract TestOracleProvider {

    bytes32 private constant _FILE = "TestOracleProvider";
    address private constant _APT = 0x3f8f0dCE4dCE4d0D1d0871941e79CDA82cA50d0B;
    address private constant _ATOM = 0x248C35760068cE009a13076D573ed3497A47bCD4;
    address private constant _BONK = 0x1FD10E767187A92f0AB2ABDEEF4505e319cA06B2;
    address private constant _EIGEN = 0x606C3e5075e5555e79Aa15F1E9FACB776F96C248;
    address private constant _NEAR = 0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C;
    address private constant _PEPE = 0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00;
    address private constant _POL = 0x9c74772b713a1B032aEB173E28683D937E51921c;
    address private constant _RENDER = 0x82BB89fcc64c5d4016C5Ed1AB016bB0D1C20D6C3;
    address private constant _SEI = 0x55e85A147a1029b985384822c0B2262dF8023452;
    address private constant _SHIB = 0x3E57D02f9d196873e55727382974b02EdebE6bfd;
    address private constant _SUI = 0x197aa2DE1313c7AD50184234490E12409B2a1f95;
    address private constant _TIA = 0x38676f62d166f5CE7De8433F51c6B3D6D9d66C19;
    address private constant _TON = 0xB2f7cefaeEb08Aa347705ac829a7b8bE2FB560f3;
    address private constant _TRX = 0xb06aa7E4af937C130dDade66f6ed7642716fe07A;
    address private constant _WLD = 0x75B9AdD873641b253718810E6c65dB6d72311FD0;
    address private constant _XRP = 0xc14e065b0067dE91534e032868f5Ac6ecf2c6868;

    IDolomitePriceOracle public immutable ORACLE_AGGREGATOR;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 10 ** 6;

    struct ValidatedPrice {
        address token;
        uint256 min;
        uint256 max;
        uint256 timestamp;
        address provider;
    }

    constructor(address _oracleAggregator) {
        ORACLE_AGGREGATOR = IDolomitePriceOracle(_oracleAggregator);
    }

    function shouldAdjustTimestamp() external view returns (bool) {
        return true;
    }

    function isChainlinkOnChainProvider() external view returns (bool) {
        return true;
    }

    function getOraclePrice(address _token, bytes memory /* _data */) external view returns (ValidatedPrice memory) {
        try ORACLE_AGGREGATOR.getPrice(_token) returns (IDolomiteStructs.MonetaryPrice memory price) {
            uint256 priceUint = price.value / GMX_DECIMAL_ADJUSTMENT;

            return ValidatedPrice({
                token: _token,
                min: priceUint,
                max: priceUint,
                timestamp: block.timestamp,
                provider: address(this)
            });
        } catch {
            require(
                block.number < 279_600_000 + 10_000,
                "Invalid block number for test provider!"
            );

            uint256 price;
            if (_token == _APT) {
                price = 13000000000000;
            } else if (_token == _ATOM) {
                price = 8500000000000;
            } else if (_token == _BONK) {
                price = 44007067;
            } else if (_token == _EIGEN) {
                price = 3540000000000;
            } else if (_token == _NEAR) {
                price = 6900000000000;
            } else if (_token == _PEPE) {
                price = 20257067;
            } else if (_token == _POL) {
                price = 560000000000;
            } else if (_token == _RENDER) {
                price = 8750000000000;
            } else if (_token == _SEI) {
                price = 650000000000;
            }  else if (_token == _SHIB) {
                price = 29007067;
            } else if (_token == _SUI) {
                price = 3480000000000;
            } else if (_token == _TIA) {
                price = 7961201590000000000000000;
            }  else if (_token == _TON) {
                price = 6600000000000;
            }  else if (_token == _TRX) {
                price = 200000000000;
            }  else if (_token == _WLD) {
                price = 2900000000000;
            } else if (_token == _XRP) {
                price = 1900000000000;
            } else {
                Require.that(
                    false,
                    _FILE,
                    "Invalid token",
                    _token
                );
            }

            return ValidatedPrice({
                token: _token,
                min: price,
                max: price,
                timestamp: block.timestamp,
                provider: address(this)
            });
        }
    }
}
