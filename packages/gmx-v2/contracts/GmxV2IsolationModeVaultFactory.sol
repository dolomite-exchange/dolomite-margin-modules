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
import { IsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeVaultFactory.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { GmxV2VaultLibrary } from "./GmxV2VaultLibrary.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GM token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 * @dev     Swap-only GMX markets ARE NOT supported by this vault factory
 */
contract GmxV2IsolationModeVaultFactory is
    IGmxV2IsolationModeVaultFactory,
    AsyncFreezableIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using EnumerableSet for EnumerableSet.UintSet;

    // ============= Structs =============

    struct ConstructorParams {
        address gmxV2Registry;
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

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Immutable Variables ============

    address public immutable override SHORT_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override LONG_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override INDEX_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable SHORT_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 public immutable LONG_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        ConstructorParams memory _params
    )
    SimpleIsolationModeVaultFactory(
        _params.initialAllowableDebtMarketIds,
        _params.initialAllowableCollateralMarketIds,
        _params.tokenAndMarketAddresses.marketToken,
        _params.borrowPositionProxyV2,
        _params.userVaultImplementation,
        _params.dolomiteRegistry,
        _params.dolomiteMargin
    )
    AsyncFreezableIsolationModeVaultFactory(
        _params.executionFee,
        _params.gmxV2Registry
    )
    {
        INDEX_TOKEN = _params.tokenAndMarketAddresses.indexToken;
        SHORT_TOKEN = _params.tokenAndMarketAddresses.shortToken;
        SHORT_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(SHORT_TOKEN);
        LONG_TOKEN = _params.tokenAndMarketAddresses.longToken;
        LONG_TOKEN_MARKET_ID = _params.skipLongToken
            ? type(uint256).max
            : DOLOMITE_MARGIN().getMarketIdByTokenAddress(LONG_TOKEN);

        GmxV2VaultLibrary.validateInitialMarketIds(
            _params.initialAllowableDebtMarketIds,
            LONG_TOKEN_MARKET_ID,
            SHORT_TOKEN_MARKET_ID
        );
        GmxV2VaultLibrary.validateInitialMarketIds(
            _params.initialAllowableCollateralMarketIds,
            LONG_TOKEN_MARKET_ID,
            SHORT_TOKEN_MARKET_ID
        );
    }

    function gmxV2Registry() external view returns (IGmxV2Registry) {
        return IGmxV2Registry(address(handlerRegistry));
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _afterInitialize() internal override(IsolationModeVaultFactory, SimpleIsolationModeVaultFactory) {
        _allowableCollateralMarketIds.push(marketId);
    }
}
