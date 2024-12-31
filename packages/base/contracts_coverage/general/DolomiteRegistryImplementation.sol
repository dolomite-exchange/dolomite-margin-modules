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
import { IBorrowPositionProxyV2 } from "../interfaces/IBorrowPositionProxyV2.sol";
import { IDolomiteAccountRegistry } from "../interfaces/IDolomiteAccountRegistry.sol";
import { IDolomiteMigrator } from "../interfaces/IDolomiteMigrator.sol";
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
    bytes32 private constant _BORROW_POSITION_PROXY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.borrowPositionProxy")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _CHAINLINK_PRICE_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.chainlinkPriceOracle")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _DOLOMITE_ACCOUNT_REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.dolomiteAccountRegistry")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _DOLOMITE_MIGRATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.dolomiteMigrator")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _EVENT_EMITTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.eventEmitter")) - 1);
    bytes32 private constant _EXPIRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.expiry")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _GENERIC_TRADER_PROXY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.genericTraderProxy")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LIQUIDATOR_ASSET_REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.liquidatorAssetRegistry")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _ORACLE_AGGREGATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.oracleAggregator")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _REDSTONE_PRICE_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.redstonePriceOracle")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.slippageToleranceForPauseSentinel")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _ISOLATION_MODE_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isolationModeStorage")) - 1); // solhint-disable-line max-line-length

    // ==================== Constructor ====================

    function initialize(
        address _borrowPositionProxy,
        address _genericTraderProxy,
        address _expiry,
        uint256 _slippageToleranceForPauseSentinel,
        address _liquidatorAssetRegistry,
        address _eventEmitter,
        address _dolomiteAccountRegistry
    ) external initializer {
        _ownerSetBorrowPositionProxy(_borrowPositionProxy);
        _ownerSetGenericTraderProxy(_genericTraderProxy);
        _ownerSetExpiry(_expiry);
        _ownerSetSlippageToleranceForPauseSentinel(_slippageToleranceForPauseSentinel);
        _ownerSetLiquidatorAssetRegistry(_liquidatorAssetRegistry);
        _ownerSetEventEmitter(_eventEmitter);
        _ownerSetDolomiteAccountRegistry(_dolomiteAccountRegistry);
    }

    function lazyInitialize(
        address _dolomiteMigrator,
        address _oracleAggregator
    ) external {
        if (address(dolomiteMigrator()) == address(0) && address(oracleAggregator()) == address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            address(dolomiteMigrator()) == address(0) && address(oracleAggregator()) == address(0),
            _FILE,
            "Already initialized"
        );

        _ownerSetDolomiteMigrator(_dolomiteMigrator);
        _ownerSetOracleAggregator(_oracleAggregator);
    }

    // ===================== Functions =====================

    function ownerSetBorrowPositionProxy(
        address _borrowPositionProxy
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBorrowPositionProxy(_borrowPositionProxy);
    }

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

    function ownerSetDolomiteMigrator(
        address _dolomiteMigrator
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDolomiteMigrator(_dolomiteMigrator);
    }

    function ownerSetRedstonePriceOracle(
        address _redstonePriceOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRedstonePriceOracle(_redstonePriceOracle);
    }

    function ownerSetOracleAggregator(
        address _oracleAggregator
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetOracleAggregator(_oracleAggregator);
    }

    function ownerSetDolomiteAccountRegistry(
        address _dolomiteAccountRegistry
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDolomiteAccountRegistry(_dolomiteAccountRegistry);
    }

    function ownerSetIsolationModeMulticallFunctions(
        bytes4[] memory _selectors
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsolationModeMulticallFunctions(_selectors);
    }

    // ========================== View Functions =========================

    function borrowPositionProxy() public view returns (IBorrowPositionProxyV2) {
        return IBorrowPositionProxyV2(_getAddress(_BORROW_POSITION_PROXY_SLOT));
    }

    function genericTraderProxy() public view returns (IGenericTraderProxyV1) {
        return IGenericTraderProxyV1(_getAddress(_GENERIC_TRADER_PROXY_SLOT));
    }

    function expiry() public view returns (IExpiry) {
        return IExpiry(_getAddress(_EXPIRY_SLOT));
    }

    function slippageToleranceForPauseSentinel() public view returns (uint256) {
        return _getUint256(_SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL_SLOT);
    }

    function liquidatorAssetRegistry() public view returns (ILiquidatorAssetRegistry) {
        return ILiquidatorAssetRegistry(_getAddress(_LIQUIDATOR_ASSET_REGISTRY_SLOT));
    }

    function eventEmitter() public view returns (IEventEmitterRegistry) {
        return IEventEmitterRegistry(_getAddress(_EVENT_EMITTER_SLOT));
    }

    function chainlinkPriceOracle() public view returns (IDolomitePriceOracle) {
        return IDolomitePriceOracle(_getAddress(_CHAINLINK_PRICE_ORACLE_SLOT));
    }

    function dolomiteMigrator() public view returns (IDolomiteMigrator) {
        return IDolomiteMigrator(_getAddress(_DOLOMITE_MIGRATOR_SLOT));
    }

    function redstonePriceOracle() public view returns (IDolomitePriceOracle) {
        return IDolomitePriceOracle(_getAddress(_REDSTONE_PRICE_ORACLE_SLOT));
    }

    function oracleAggregator() public view returns (IDolomitePriceOracle) {
        return IDolomitePriceOracle(_getAddress(_ORACLE_AGGREGATOR_SLOT));
    }

    function dolomiteAccountRegistry() public view returns (IDolomiteAccountRegistry) {
        return IDolomiteAccountRegistry(_getAddress(_DOLOMITE_ACCOUNT_REGISTRY_SLOT));
    }

    function isolationModeMulticallFunctions() public view returns (bytes4[] memory) {
        IsolationModeStorage storage ims;
        bytes32 slot = _ISOLATION_MODE_STORAGE_SLOT;
        assembly {
            ims.slot := slot
        }

        return ims.isolationModeMulticallFunctions;
    }

    function slippageToleranceForPauseSentinelBase() public pure returns (uint256) {
        return 1e18;
    }

    // ===================== Internal Functions =====================

    function _ownerSetBorrowPositionProxy(
        address _borrowPositionProxy
    ) internal {
        if (_borrowPositionProxy != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _borrowPositionProxy != address(0),
            _FILE,
            "Invalid borrowPositionProxy"
        );

        _setAddress(_BORROW_POSITION_PROXY_SLOT, _borrowPositionProxy);
        emit BorrowPositionProxySet(_borrowPositionProxy);
    }

    function _ownerSetGenericTraderProxy(
        address _genericTraderProxy
    ) internal {
        if (_genericTraderProxy != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _genericTraderProxy != address(0),
            _FILE,
            "Invalid genericTraderProxy"
        );

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

    function _ownerSetDolomiteMigrator(
        address _dolomiteMigrator
    ) internal {
        if (_dolomiteMigrator != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteMigrator != address(0),
            _FILE,
            "Invalid dolomiteMigrator"
        );

        _setAddress(_DOLOMITE_MIGRATOR_SLOT, _dolomiteMigrator);
        emit DolomiteMigratorSet(_dolomiteMigrator);
    }

    function _ownerSetRedstonePriceOracle(
        address _redstonePriceOracle
    ) internal {
        if (_redstonePriceOracle != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _redstonePriceOracle != address(0),
            _FILE,
            "Invalid redstonePriceOracle"
        );

        _setAddress(_REDSTONE_PRICE_ORACLE_SLOT, _redstonePriceOracle);
        emit RedstonePriceOracleSet(_redstonePriceOracle);
    }

    function _ownerSetOracleAggregator(
        address _oracleAggregator
    ) internal {
        if (_oracleAggregator != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _oracleAggregator != address(0),
            _FILE,
            "Invalid oracleAggregator"
        );

        _setAddress(_ORACLE_AGGREGATOR_SLOT, _oracleAggregator);
        emit OracleAggregatorSet(_oracleAggregator);
    }

    function _ownerSetDolomiteAccountRegistry(
        address _dolomiteAccountRegistry
    ) internal {
        if (_dolomiteAccountRegistry != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteAccountRegistry != address(0),
            _FILE,
            "Invalid dolomiteAccountRegistry"
        );

        _setAddress(_DOLOMITE_ACCOUNT_REGISTRY_SLOT, _dolomiteAccountRegistry);
        emit DolomiteAccountRegistrySet(_dolomiteAccountRegistry);
    }

    function _ownerSetIsolationModeMulticallFunctions(
        bytes4[] memory _selectors
    ) internal {
        uint256 len = _selectors.length;
        if (len > 0) {
            for (uint256 i; i < len - 1; ++i) {
                if (_selectors[i] < _selectors[i + 1]) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    _selectors[i] < _selectors[i + 1],
                    _FILE,
                    "Selectors not sorted"
                );
            }
        }

        IsolationModeStorage storage ims;
        bytes32 slot = _ISOLATION_MODE_STORAGE_SLOT;
        assembly {
            ims.slot := slot
        }

        ims.isolationModeMulticallFunctions = _selectors;
        emit IsolationModeMulticallFunctionsSet(_selectors);
    }
}
