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

// solhint-disable max-line-length
import { SimpleIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/SimpleIsolationModeVaultFactory.sol";
import { AsyncFreezableIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/AsyncFreezableIsolationModeVaultFactory.sol";
import { GmxV2Library } from "@dolomite-exchange/modules-gmx-v2/contracts/GmxV2Library.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { GlvLibrary } from "./GlvLibrary.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
// solhint-enable max-line-length


/**
 * @title   GlvIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GLV token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GlvIsolationModeVaultFactory is
    IGlvIsolationModeVaultFactory,
    AsyncFreezableIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using EnumerableSet for EnumerableSet.UintSet;
    using GlvLibrary for GlvIsolationModeVaultFactory;

    // ============= Structs =============

    struct ConstructorParams {
        address glvRegistry;
        uint256 executionFee;
        MarketInfoConstructorParams tokenAndMarketAddresses;
        bool skipLongToken;
        uint256[] initialAllowableDebtMarketIds;
        uint256[] initialAllowableCollateralMarketIds;
        address borrowPositionProxyV2;
        address userVaultImplementation;
        address dolomiteRegistry;
        address dolomiteMargin;
    }

    // ============ Constants ============

    bytes32 private constant _FILE = "GlvIsolationModeVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Immutable Variables ============

    address public immutable override SHORT_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override LONG_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable SHORT_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 public immutable LONG_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        ConstructorParams memory _params
    )
    SimpleIsolationModeVaultFactory(
        _params.initialAllowableDebtMarketIds,
        _params.initialAllowableCollateralMarketIds,
        _params.tokenAndMarketAddresses.glvToken,
        _params.borrowPositionProxyV2,
        _params.userVaultImplementation,
        _params.dolomiteRegistry,
        _params.dolomiteMargin
    )
    AsyncFreezableIsolationModeVaultFactory(
        _params.executionFee,
        _params.glvRegistry
    )
    {
        SHORT_TOKEN = _params.tokenAndMarketAddresses.shortToken;
        SHORT_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(SHORT_TOKEN);
        LONG_TOKEN = _params.tokenAndMarketAddresses.longToken;
        LONG_TOKEN_MARKET_ID = _params.skipLongToken
            ? type(uint256).max
            : DOLOMITE_MARGIN().getMarketIdByTokenAddress(LONG_TOKEN);

        GmxV2Library.validateInitialMarketIds(
            _params.initialAllowableDebtMarketIds,
            LONG_TOKEN_MARKET_ID,
            SHORT_TOKEN_MARKET_ID
        );
        GmxV2Library.validateInitialMarketIds(
            _params.initialAllowableCollateralMarketIds,
            LONG_TOKEN_MARKET_ID,
            SHORT_TOKEN_MARKET_ID
        );
    }

    function glvRegistry() external view returns (IGlvRegistry) {
        return IGlvRegistry(address(handlerRegistry));
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _afterInitialize() internal override {
        _allowableCollateralMarketIds.push(marketId);
    }
}
