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

import { IBorrowPositionProxyV2 } from "./IBorrowPositionProxyV2.sol";
import { IDolomiteAccountRegistry } from "./IDolomiteAccountRegistry.sol";
import { IDolomiteMigrator } from "./IDolomiteMigrator.sol";
import { IEventEmitterRegistry } from "./IEventEmitterRegistry.sol";
import { IExpiry } from "./IExpiry.sol";
import { ILiquidatorAssetRegistry } from "./ILiquidatorAssetRegistry.sol";
import { IDolomitePriceOracle } from "../protocol/interfaces/IDolomitePriceOracle.sol";
import { IGenericTraderProxyV2 } from "../proxies/interfaces/IGenericTraderProxyV2.sol";


/**
 * @title   IDolomiteRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with Umami's Delta Neutral vaults
 */
interface IDolomiteRegistry {

    struct IsolationModeStorage {
        bytes4[] isolationModeMulticallFunctions;
    }

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event AdminRegistrySet(address indexed _adminRegistry);
    event BlacklistedAddressesSet(address[] _blacklistedAddresses, bool[] _isBlacklisted);
    event BorrowPositionProxySet(address indexed _borrowPositionProxy);
    event GenericTraderProxySet(address indexed _genericTraderProxy);
    event ExpirySet(address indexed _expiry);
    event FeeAgentSet(address indexed _feeAgent);
    event SlippageToleranceForPauseSentinelSet(uint256 _slippageTolerance);
    event LiquidatorAssetRegistrySet(address indexed _liquidatorAssetRegistry);
    event EventEmitterSet(address indexed _eventEmitter);
    event ChainlinkPriceOracleSet(address indexed _chainlinkPriceOracle);
    event DolomiteMigratorSet(address indexed _dolomiteMigrator);
    event RedstonePriceOracleSet(address indexed _redstonePriceOracle);
    event OracleAggregatorSet(address indexed _oracleAggregator);
    event DolomiteAccountRegistrySet(address indexed _dolomiteAccountRegistry);
    event TrustedInternalTradersSet(address[] _trustedInternalTraders, bool[] _isTrusted);
    event IsolationModeMulticallFunctionsSet(bytes4[] _selectors);
    event TreasurySet(address indexed _treasury);
    event DaoSet(address indexed _dao);

    // ========================================================
    // =================== Write Functions ====================
    // ========================================================

    function lazyInitialize(address _dolomiteMigrator, address _oracleAggregator) external;

    /**
     *
     * @param  _adminRegistry    The new address of the admin registry
     */
    function ownerSetAdminRegistry(address _adminRegistry) external;

    /**
     *
     * @param  _blacklistedAddresses    The addresses to blacklist
     * @param  _isBlacklisted           Whether the addresses are blacklisted
     */
    function ownerSetBlacklistedAddresses(address[] memory _blacklistedAddresses, bool[] memory _isBlacklisted) external;

    /**
     *
     * @param  _borrowPositionProxy  The new address of the borrow position proxy
     */
    function ownerSetBorrowPositionProxy(address _borrowPositionProxy) external;

    /**
     *
     * @param  _genericTraderProxy  The new address of the generic trader proxy
     */
    function ownerSetGenericTraderProxy(address _genericTraderProxy) external;

    /**
     *
     * @param  _expiry  The new address of the expiry contract
     */
    function ownerSetExpiry(address _expiry) external;

    /**
     *
     * @param  _feeAgent  The new address of the fee agent
     */
    function ownerSetFeeAgent(address _feeAgent) external;

    /**
     *
     * @param  _slippageToleranceForPauseSentinel   The slippage tolerance (using 1e18 as the base) for zaps when pauses
     *                                              are enabled
     */
    function ownerSetSlippageToleranceForPauseSentinel(uint256 _slippageToleranceForPauseSentinel) external;

    /**
     *
     * @param  _liquidatorRegistry  The new address of the liquidator registry
     */
    function ownerSetLiquidatorAssetRegistry(address _liquidatorRegistry) external;

    /**
     *
     * @param  _eventEmitter  The new address of the event emitter
     */
    function ownerSetEventEmitter(address _eventEmitter) external;

    /**
     *
     * @param  _chainlinkPriceOracle    The new address of the Chainlink price oracle that's compatible with
     *                                  DolomiteMargin.
     */
    function ownerSetChainlinkPriceOracle(address _chainlinkPriceOracle) external;

    /**
     *
     * @param  _dolomiteMigrator    The new address of the Dolomite migrator
     */
    function ownerSetDolomiteMigrator(address _dolomiteMigrator) external;

    /**
     *
     * @param  _redstonePriceOracle    The new address of the Redstone price oracle that's compatible with
     *                                  DolomiteMargin.
     */
    function ownerSetRedstonePriceOracle(address _redstonePriceOracle) external;

    /**
     *
     * @param  _oracleAggregator    The new address of the oracle aggregator that's compatible with
     *                              DolomiteMargin.
     */
    function ownerSetOracleAggregator(address _oracleAggregator) external;

    /**
     *
     * @param  _dolomiteAccountRegistry    The new address of the Dolomite address registry
     */
    function ownerSetDolomiteAccountRegistry(address _dolomiteAccountRegistry) external;

    /**
     *
     * @param  _trustedInternalTraders    The addresses of the trusted internal traders
     * @param  _isTrusted                 The boolean values for whether the traders are trusted
     */
    function ownerSetTrustedInternalTraders(
        address[] memory _trustedInternalTraders,
        bool[] memory _isTrusted
    ) external;

    /**
     *
     * @param  _treasury    The new address of the treasury
     */
    function ownerSetTreasury(address _treasury) external;

    /**
     *
     * @param  _dao    The new address of the DAO
     */
    function ownerSetDao(address _dao) external;

    /**
     *
     * @param  _selectors    Allowed function selectors for isolation mode multicall
     */
    function ownerSetIsolationModeMulticallFunctions(bytes4[] memory _selectors) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    /**
     * @return The address of the admin registry
     */
    function adminRegistry() external view returns (address);

    /**
     * @return  The address of the borrow position proxy
     */
    function borrowPositionProxy() external view returns (IBorrowPositionProxyV2);

    /**
     * @return  The address of the generic trader proxy for making zaps
     */
    function genericTraderProxy() external view returns (IGenericTraderProxyV2);

    /**
     * @return  The address of the expiry contract
     */
    function expiry() external view returns (IExpiry);

    /**
     * @return  The slippage tolerance (using 1e18 as the base) for zaps when pauses are enabled
     */
    function slippageToleranceForPauseSentinel() external view returns (uint256);

    /**
     * @return  The address of the liquidator asset registry contract
     */
    function liquidatorAssetRegistry() external view returns (ILiquidatorAssetRegistry);

    /**
     * @return The address of the emitter contract that can emit certain events for indexing
     */
    function eventEmitter() external view returns (IEventEmitterRegistry);

    /**
     * @return The address of the fee agent
     */
    function feeAgent() external view returns (address);

    /**
     * @return The address of the Chainlink price oracle that's compatible with DolomiteMargin
     */
    function chainlinkPriceOracle() external view returns (IDolomitePriceOracle);

    /**
     * @return The address of the migrator contract
     */
    function dolomiteMigrator() external view returns (IDolomiteMigrator);

    /**
     * @return The address of the Redstone price oracle that's compatible with DolomiteMargin
     */
    function redstonePriceOracle() external view returns (IDolomitePriceOracle);

    /**
     * @return The address of the oracle aggregator that's compatible with DolomiteMargin
     */
    function oracleAggregator() external view returns (IDolomitePriceOracle);

    /**
     * @return The address of the Dolomite address registry
     */
    function dolomiteAccountRegistry() external view returns (IDolomiteAccountRegistry);

    /**
     * @return The array of allowed function selectors for isolation mode multicall
     */
    function isolationModeMulticallFunctions() external view returns (bytes4[] memory);

    /**
     * @return The base (denominator) for the slippage tolerance variable. Always 1e18.
     */
    function slippageToleranceForPauseSentinelBase() external pure returns (uint256);

    /**
     *
     * @param  _trader  The address of the trader
     * @return  Whether the trader is trusted
     */
    function isTrustedInternalTrader(address _trader) external view returns (bool);

    /**
     * @param  _address  The address to check if it's blacklisted
     * @return  Whether the address is blacklisted
     */
    function isBlacklisted(address _address) external view returns (bool);

    /**
     * @return The address of the treasury
     */
    function treasury() external view returns (address);

    /**
     * @return The address of the DAO multisig
     */
    function dao() external view returns (address);
}
