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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { ILiquidatorAssetRegistry } from "../interfaces/ILiquidatorAssetRegistry.sol";
import { ValidationLib } from "../lib/ValidationLib.sol";
import { IDolomitePriceOracle } from "../protocol/interfaces/IDolomitePriceOracle.sol";
import { Require } from "../protocol/lib/Require.sol";

/**
 * @title   DolomiteRegistryImplementation
 * @author  Dolomite
 *
 * @notice  Registry contract for storing Dolomite-related addresses
 */
contract DolomiteRegistryImplementation is
    IDolomiteRegistry,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{

    // ===================== Constants =====================

    bytes32 private constant _FILE = "DolomiteRegistryImplementation";
    bytes32 private constant _GENERIC_TRADER_PROXY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.genericTraderProxy")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _EXPIRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.expiry")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.slippageToleranceForPauseSentinel")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LIQUIDATOR_ASSET_REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.liquidatorAssetRegistry")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _EVENT_EMITTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.eventEmitter")) - 1);
    bytes32 private constant _CHAINLINK_PRICE_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.chainlinkPriceOracle")) - 1); // solhint-disable-line max-line-length

    // ==================== Constructor ====================

    function initialize(
        address _genericTraderProxy,
        address _expiry,
        uint256 _slippageToleranceForPauseSentinel,
        address _liquidatorAssetRegistry,
        address _eventEmitter,
        address _chainlinkPriceOracle
    ) external initializer {
        _ownerSetGenericTraderProxy(_genericTraderProxy);
        _ownerSetExpiry(_expiry);
        _ownerSetSlippageToleranceForPauseSentinel(_slippageToleranceForPauseSentinel);
        _ownerSetLiquidatorAssetRegistry(_liquidatorAssetRegistry);
        _ownerSetEventEmitter(_eventEmitter);
        _ownerSetChainlinkPriceOracle(_chainlinkPriceOracle);
    }

    // ===================== Functions =====================

    function ownerSetGenericTraderProxy(
        address _genericTraderProxy
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGenericTraderProxy(_genericTraderProxy);
    }

    function ownerSetExpiry(
        address _expiry
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetExpiry(_expiry);
    }

    function ownerSetSlippageToleranceForPauseSentinel(
        uint256 _slippageToleranceForPauseSentinel
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSlippageToleranceForPauseSentinel(_slippageToleranceForPauseSentinel);
    }

    function ownerSetLiquidatorAssetRegistry(
        address _liquidatorAssetRegistry
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetLiquidatorAssetRegistry(_liquidatorAssetRegistry);
    }

    function ownerSetEventEmitter(
        address _eventEmitter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetEventEmitter(_eventEmitter);
    }

    function ownerSetChainlinkPriceOracle(
        address _chainlinkPriceOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetChainlinkPriceOracle(_chainlinkPriceOracle);
    }

    // ========================== View Functions =========================

    function genericTraderProxy() external view returns (IGenericTraderProxyV1) {
        return IGenericTraderProxyV1(_getAddress(_GENERIC_TRADER_PROXY_SLOT));
    }

    function expiry() external view returns (IExpiry) {
        return IExpiry(_getAddress(_EXPIRY_SLOT));
    }

    function slippageToleranceForPauseSentinel() external view returns (uint256) {
        return _getUint256(_SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL_SLOT);
    }

    function liquidatorAssetRegistry() external view returns (ILiquidatorAssetRegistry) {
        return ILiquidatorAssetRegistry(_getAddress(_LIQUIDATOR_ASSET_REGISTRY_SLOT));
    }

    function eventEmitter() external view returns (IEventEmitterRegistry) {
        return IEventEmitterRegistry(_getAddress(_EVENT_EMITTER_SLOT));
    }

    function chainlinkPriceOracle() external view returns (IDolomitePriceOracle) {
        return IDolomitePriceOracle(_getAddress(_CHAINLINK_PRICE_ORACLE_SLOT));
    }

    function slippageToleranceForPauseSentinelBase() external pure returns (uint256) {
        return 1e18;
    }

    // ===================== Internal Functions =====================

    function _ownerSetGenericTraderProxy(
        address _genericTraderProxy
    ) internal {
        if (_genericTraderProxy != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _genericTraderProxy != address(0),
            _FILE,
            "Invalid genericTraderProxy"
        );
         bytes memory returnData = ValidationLib.callAndCheckSuccess(
             _genericTraderProxy,
             IGenericTraderProxyV1(_genericTraderProxy).EXPIRY.selector,
             bytes("")
         );
         abi.decode(returnData, (address));

        _setAddress(_GENERIC_TRADER_PROXY_SLOT, _genericTraderProxy);
        emit GenericTraderProxySet(_genericTraderProxy);
    }

    function _ownerSetExpiry(
        address _expiry
    ) internal {
        if (_expiry != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _expiry != address(0),
            _FILE,
            "Invalid expiry"
        );
        bytes memory returnData = ValidationLib.callAndCheckSuccess(
            _expiry,
            IExpiry(_expiry).g_expiryRampTime.selector,
            bytes("")
        );
        abi.decode(returnData, (uint256));

        _setAddress(_EXPIRY_SLOT, _expiry);
        emit ExpirySet(_expiry);
    }

    function _ownerSetSlippageToleranceForPauseSentinel(
        uint256 _slippageToleranceForPauseSentinel
    ) internal {
        if (_slippageToleranceForPauseSentinel > 0 && _slippageToleranceForPauseSentinel < 1e18) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _slippageToleranceForPauseSentinel > 0 && _slippageToleranceForPauseSentinel < 1e18,
            _FILE,
            "Invalid slippageTolerance"
        );

        _setUint256(_SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL_SLOT, _slippageToleranceForPauseSentinel);
        emit SlippageToleranceForPauseSentinelSet(_slippageToleranceForPauseSentinel);
    }

    function _ownerSetLiquidatorAssetRegistry(
        address _liquidatorAssetRegistry
    ) internal {
        if (_liquidatorAssetRegistry != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _liquidatorAssetRegistry != address(0),
            _FILE,
            "Invalid liquidatorAssetRegistry"
        );
        bytes memory returnData = ValidationLib.callAndCheckSuccess(
            _liquidatorAssetRegistry,
            ILiquidatorAssetRegistry(_liquidatorAssetRegistry).getLiquidatorsForAsset.selector,
            abi.encode(uint256(0))
        );
        abi.decode(returnData, (uint256[]));

        _setAddress(_LIQUIDATOR_ASSET_REGISTRY_SLOT, _liquidatorAssetRegistry);
        emit LiquidatorAssetRegistrySet(_liquidatorAssetRegistry);
    }

    function _ownerSetEventEmitter(
        address _eventEmitter
    ) internal {
        if (_eventEmitter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _eventEmitter != address(0),
            _FILE,
            "Invalid eventEmitter"
        );

        _setAddress(_EVENT_EMITTER_SLOT, _eventEmitter);
        emit EventEmitterSet(_eventEmitter);
    }

    function _ownerSetChainlinkPriceOracle(
        address _chainlinkPriceOracle
    ) internal {
        if (_chainlinkPriceOracle != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _chainlinkPriceOracle != address(0),
            _FILE,
            "Invalid chainlinkPriceOracle"
        );

        _setAddress(_CHAINLINK_PRICE_ORACLE_SLOT, _chainlinkPriceOracle);
        emit ChainlinkPriceOracleSet(_chainlinkPriceOracle);
    }
}
