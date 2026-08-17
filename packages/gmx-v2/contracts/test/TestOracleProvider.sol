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
    address private constant _AERO = 0xEcc5eb985Ddbb8335b175b0A2A1144E4c978F1f6;
    address private constant _AIXBT = 0xcA543Cb8bCC76e4E0A034F56EB40a1029bDFd70E;
    address private constant _APT = 0x3f8f0dCE4dCE4d0D1d0871941e79CDA82cA50d0B;
    address private constant _ATOM = 0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA;
    address private constant _AVNT = 0xdB58EB7f408EbA2176eCb44A4696292605cCEB39;
    address private constant _BERA = 0x67ADABbAd211eA9b3B4E2fd0FD165E593De1e983;
    address private constant _BONK = 0x1FD10E767187A92f0AB2ABDEEF4505e319cA06B2;
    address private constant _BRENTOIL = 0x9C5C4b9BA1fEBA72186f50d8Ae7C58b1D7f0B12F;
    address private constant _CHZ = 0x5dB4692926C8ceebF6Da0995358Bbc438F3fd80C;
    address private constant _CRV = 0xe5f01aeAcc8288E9838A60016AB00d7b6675900b;
    address private constant _CVX = 0x3B6f801C0052Dfe0Ac80287D611F31B7c47B9A6b;
    address private constant _DOGE = 0xC4da4c24fd591125c3F47b340b6f4f76111883d8;
    address private constant _DOLO = 0x97Ce1F309B949f7FBC4f58c5cb6aa417A5ff8964;
    address private constant _EIGEN = 0x606C3e5075e5555e79Aa15F1E9FACB776F96C248;
    address private constant _ENA = 0xfe1Aac2CD9C5cC77b58EeCfE75981866ed0c8b7a;
    address private constant _FET = 0x83D5944E7f5EF1d8432002d3cb062e1012f6F8e6;
    address private constant _GOLD = 0xc48d782c5C54157d37d2Fa4E6BA27E8cf57Da956;
    address private constant _LDO = 0x9D678B4Dd38a6E01df8090aEB7974aD71142b05f;
    address private constant _LINEA = 0xc4017CFe7D7eaBDE63d3252caBF26A286fE2B1E0;
    address private constant _LINK = 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4;
    address private constant _LIT = 0xE6172EecBB07F197F52bb73d74daa0e19C31c4Db;
    address private constant _LTC = 0xB46A094Bc4B0adBD801E14b9DB95e05E28962764;
    address private constant _MEGA = 0x13983f27Ce9365055a6a553233c49fE28e70103e;
    address private constant _MNT = 0x955cd91eEaE618F5a7b49E1e3c7482833B10DAb4;
    address private constant _MON = 0xB96e60CA3a7677b29f1e10dd109E952B275038Be;
    address private constant _MORPHO = 0xF67b2a901D674B443Fa9f6DB2A689B37c07fD4fE;
    address private constant _NATGAS = 0x620aC65BE29066Bb9D1E92C65b35B9fD321Fb963;
    address private constant _NEAR = 0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C;
    address private constant _OKB = 0xd37F01A3379f052FEF70F63c0Be27931891aa2B9;
    address private constant _ONDO = 0xEcFB4718aD19b626A77491895a2f99ea0cedEd08;
    address private constant _PEPE = 0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00;
    address private constant _POL = 0x9c74772b713a1B032aEB173E28683D937E51921c;
    address private constant _RENDER = 0x82BB89fcc64c5d4016C5Ed1AB016bB0D1C20D6C3;
    address private constant _SEI = 0x55e85A147a1029b985384822c0B2262dF8023452;
    address private constant _SHIB = 0x3E57D02f9d196873e55727382974b02EdebE6bfd;
    address private constant _SILVER = 0xE41902f9aD379A8CC34A34efa00F5c3EE5112bC8;
    address private constant _SKY = 0xeeA41ceA2204D1156De1BDF2CF4ab6184d17f90B;
    address private constant _SPCX = 0x8CBd0d5d81e7957123E6D8fFaE657a40bDC5691b;
    address private constant _SPX6900 = 0xb736be525A65326513351058427d1f47B0CfB045;
    address private constant _SUI = 0x197aa2DE1313c7AD50184234490E12409B2a1f95;
    address private constant _SYRUP = 0x9759C297fb6C91e252c7292cECa30a509558E5De;
    address private constant _TIA = 0x38676f62d166f5CE7De8433F51c6B3D6D9d66C19;
    address private constant _TON = 0xB2f7cefaeEb08Aa347705ac829a7b8bE2FB560f3;
    address private constant _TRX = 0xb06aa7E4af937C130dDade66f6ed7642716fe07A;
    address private constant _TRUMP = 0x30021aFA4767Ad66aA52A06dF8a5AB3acA9371fD;
    address private constant _VVV = 0xB79Eb5BA64A167676694bB41bc1640F95d309a2F;
    address private constant _WLD = 0x75B9AdD873641b253718810E6c65dB6d72311FD0;
    address private constant _WLFI = 0xC5799ab6E2818fD8d0788dB8D156B0c5db1Bf97b;
    address private constant _WTIOIL = 0xa8Ffb545d5cBF1F44E3eBA123D60372cD267D73c;
    address private constant _XRP = 0xc14e065b0067dE91534e032868f5Ac6ecf2c6868;
    address private constant _ZORA = 0xc5ff0eB026dB972F95DF3dfF04e697d8b660092a;
    address private constant _ZRO = 0xa8193C55C34Ed22e1Dbe73FD5Adc668E51578a67;

    IDolomitePriceOracle public immutable ORACLE_AGGREGATOR;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 10 ** 6;

    struct ValidatedPrice {
        address token;
        uint256 min;
        uint256 max;
        uint256 rawMin;
        uint256 rawMax;
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

    function shouldCheckRefPrice() external view returns (bool) {
        return false;
    }

    function getOraclePrice(address _token, bytes memory /* _data */) external view returns (ValidatedPrice memory) {
        try ORACLE_AGGREGATOR.getPrice(_token) returns (IDolomiteStructs.MonetaryPrice memory price) {
            uint256 priceUint = price.value / GMX_DECIMAL_ADJUSTMENT;

            return ValidatedPrice({
                token: _token,
                min: priceUint,
                max: priceUint,
                rawMin: priceUint,
                rawMax: priceUint,
                timestamp: block.timestamp,
                provider: address(this)
            });
        } catch {
            uint256 minPrice;
            uint256 maxPrice;
            if (_token == _AERO) {
                minPrice = 404138601284;
                maxPrice = 404263129620;
            } else if (_token == _AIXBT) {
                minPrice = 17645412844;
                maxPrice = 17653881276;
            } else if (_token == _APT) {
                minPrice = 5413759884571597500000;
                maxPrice = 5417213371104872500000;
            } else if (_token == _ATOM) {
                minPrice = 1518186775000000000000000;
                maxPrice = 1518940325000000000000000;
            } else if (_token == _AVNT) {
                minPrice = 106199783211;
                maxPrice = 106257465649;
            } else if (_token == _BERA) {
                minPrice = 140243813114;
                maxPrice = 140299361339;
            } else if (_token == _BONK) {
                minPrice = 23810586017175000000;
                maxPrice = 23836862005725000000;
            } else if (_token == _BRENTOIL) {
                minPrice = 86002500000000;
                maxPrice = 86007500000000;
            } else if (_token == _CHZ) {
                minPrice = 12407258227;
                maxPrice = 12415241731;
            } else if (_token == _CRV) {
                minPrice = 244786982930;
                maxPrice = 244896348791;
            } else if (_token == _CVX) {
                minPrice = 1594430149870;
                maxPrice = 1595915705195;
            } else if (_token == _DOGE) {
                minPrice = 699176461258849425000;
                maxPrice = 699255162746147475000;
            } else if (_token == _DOLO) {
                minPrice = 22871096070;
                maxPrice = 22903698690;
            } else if (_token == _EIGEN) {
                minPrice = 168757574376;
                maxPrice = 168825844793;
            } else if (_token == _ENA) {
                minPrice = 83846558862;
                maxPrice = 83873689101;
            } else if (_token == _FET) {
                minPrice = 134883175070;
                maxPrice = 134930612080;
            } else if (_token == _GOLD) {
                minPrice = 4391452500000000;
                maxPrice = 4391457500000000;
            } else if (_token == _LDO) {
                minPrice = 293189246680;
                maxPrice = 293295872358;
            } else if (_token == _LINEA) {
                minPrice = 2144646738;
                maxPrice = 2145761099;
            } else if (_token == _LINK) {
                minPrice = 8841635428816;
                maxPrice = 8843770697857;
            } else if (_token == _LIT) {
                minPrice = 2225278061878;
                maxPrice = 2226485647293;
            } else if (_token == _LTC) {
                minPrice = 439010431350954175000000;
                maxPrice = 439081634052862525000000;
            } else if (_token == _MEGA) {
                minPrice = 30620804676;
                maxPrice = 30630489063;
            } else if (_token == _MNT) {
                minPrice = 447733428663;
                maxPrice = 447810636222;
            } else if (_token == _MON) {
                minPrice = 21151366115;
                maxPrice = 21157186346;
            } else if (_token == _MORPHO) {
                minPrice = 1923435352394;
                maxPrice = 1924290510798;
            } else if (_token == _NATGAS) {
                minPrice = 2809250000000;
                maxPrice = 2809750000000;
            } else if (_token == _NEAR) {
                minPrice = 1597849;
                maxPrice = 1598325;
            } else if (_token == _OKB) {
                minPrice = 105816754662247;
                maxPrice = 105854969421840;
            } else if (_token == _ONDO) {
                minPrice = 327541143165;
                maxPrice = 327611189495;
            } else if (_token == _PEPE) {
                minPrice = 2668026;
                maxPrice = 2670369;
            } else if (_token == _POL) {
                minPrice = 73821419354;
                maxPrice = 73839187944;
            } else if (_token == _RENDER) {
                minPrice = 1254836113750;
                maxPrice = 1255561921250;
            } else if (_token == _SEI) {
                minPrice = 40045685257;
                maxPrice = 40055228419;
            } else if (_token == _SHIB) {
                minPrice = 4597148;
                maxPrice = 4599716;
            } else if (_token == _SILVER) {
                minPrice = 65002500000000;
                maxPrice = 65007500000000;
            } else if (_token == _SKY) {
                minPrice = 52439214550;
                maxPrice = 52466301409;
            } else if (_token == _SPCX) {
                minPrice = 137472500000000;
                maxPrice = 137477500000000;
            } else if (_token == _SPX6900) {
                minPrice = 3165785806082369000000;
                maxPrice = 3166680739944699000000;
            } else if (_token == _SUI) {
                minPrice = 678176869185204775000;
                maxPrice = 678238481080078925000;
            } else if (_token == _SYRUP) {
                minPrice = 150925502486;
                maxPrice = 150992816123;
            } else if (_token == _TIA) {
                minPrice = 304354797591864215000000;
                maxPrice = 304453752775592645000000;
            } else if (_token == _TON) {
                minPrice = 6600000000000;
                maxPrice = 6600000000000;
            } else if (_token == _TRX) {
                minPrice = 332088364614040720000000;
                maxPrice = 332144708204680240000000;
            } else if (_token == _TRUMP) {
                minPrice = 1421642575717203475000000;
                maxPrice = 1422244707151610425000000;
            } else if (_token == _VVV) {
                minPrice = 12084568393883;
                maxPrice = 12089061006135;
            } else if (_token == _WLD) {
                minPrice = 343523011918;
                maxPrice = 343610193535;
            } else if (_token == _WLFI) {
                minPrice = 55349962992;
                maxPrice = 55391805646;
            } else if (_token == _WTIOIL) {
                minPrice = 81032500000000;
                maxPrice = 81037500000000;
            } else if (_token == _XRP) {
                minPrice = 1003727360998022975000000;
                maxPrice = 1003800448161297125000000;
            } else if (_token == _ZORA) {
                minPrice = 4883330028;
                maxPrice = 4886373833;
            } else if (_token == _ZRO) {
                minPrice = 783547092821;
                maxPrice = 783995538463;
            } else {
                // Require.that(
                //     false,
                //     _FILE,
                //     "Invalid token",
                //     _token
                // );
                minPrice = 10000000000000;
                maxPrice = 10000000000000;
            }

            return ValidatedPrice({
                token: _token,
                min: minPrice,
                max: maxPrice,
                rawMin: minPrice,
                rawMax: maxPrice,
                timestamp: block.timestamp,
                provider: address(this)
            });
        }
    }
}
