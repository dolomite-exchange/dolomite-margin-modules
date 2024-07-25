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
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { GmxV2Library } from "../GmxV2Library.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "../interfaces/IGmxV2Registry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
// solhint-enable max-line-length


/**
 * @title   GmSolIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GMSol token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 * @dev     Swap-only GMX markets ARE NOT supported by this vault factory
 */
contract GmxV2IsolationModeVaultFactory is
    IGmxV2IsolationModeVaultFactory,
    AsyncFreezableIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using EnumerableSet for EnumerableSet.UintSet;
    using GmxV2Library for GmxV2IsolationModeVaultFactory;

    // ============= Structs =============

    struct ConstructorParams {
        address gmxV2Registry;
        uint256 executionFee;
        MarketInfoConstructorParams tokenAndMarketAddresses;
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
    // uint256 public immutable INDEX_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
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
        // INDEX_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(INDEX_TOKEN);
        SHORT_TOKEN = _params.tokenAndMarketAddresses.shortToken;
        SHORT_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(SHORT_TOKEN);
        LONG_TOKEN = _params.tokenAndMarketAddresses.longToken;
        LONG_TOKEN_MARKET_ID = type(uint256).max; // This is set to max because the long token is not listed on Dolomite

        Require.that(
            _params.initialAllowableDebtMarketIds.length == 1
                && _params.initialAllowableDebtMarketIds[0] == SHORT_TOKEN_MARKET_ID,
            _FILE,
            "Invalid debt markets"
        );
        Require.that(
            _params.initialAllowableCollateralMarketIds.length == 1
                && _params.initialAllowableCollateralMarketIds[0] == SHORT_TOKEN_MARKET_ID,
            _FILE,
            "Invalid collateral markets"
        );
    }

    function gmxV2Registry() external view returns (IGmxV2Registry) {
        return IGmxV2Registry(address(handlerRegistry));
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _afterInitialize() internal override {
        _allowableCollateralMarketIds.push(marketId);
    }
}
