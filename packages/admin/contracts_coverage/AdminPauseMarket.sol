// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IAdminPauseMarket } from "./interfaces/IAdminPauseMarket.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminPauseMarket
 * @author  Dolomite
 *
 * @notice  Contract that enables an admin to completely pause a market
 */
contract AdminPauseMarket is OnlyDolomiteMargin, AdminRegistryHelper, IDolomitePriceOracle, IAdminPauseMarket {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminPauseMarket";
    bytes32 public constant ADMIN_PAUSE_MARKET_ROLE = keccak256("AdminPauseMarket");

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ===================================================================
    // ========================= State Variables =========================
    // ===================================================================

    mapping(address => bool) internal _tokenToPaused;

    // ===================================================================
    // =========================== Constructors ==========================
    // ===================================================================

    constructor(
        address _adminRegistry,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ===================================================================
    // ============================ Admin Functions ======================
    // ===================================================================

    function pauseMarket(
        uint256 _marketId
    )
        external
        checkPermission(this.pauseMarket.selector, msg.sender)
    {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        if (!_tokenToPaused[token]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !_tokenToPaused[token],
            _FILE,
            "Market is already paused"
        );

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetPriceOracle.selector,
                _marketId,
                address(this)
            )
        );

        _tokenToPaused[token] = true;
        emit SetMarketPaused(_marketId, true);
    }

    function unpauseMarket(
        uint256 _marketId,
        address _priceOracle
    )
        external
        checkPermission(this.unpauseMarket.selector, msg.sender)
    {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        if (_priceOracle != address(0) && _tokenToPaused[token]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _priceOracle != address(0) && _tokenToPaused[token],
            _FILE,
            "Invalid parameters"
        );
        _tokenToPaused[token] = false;

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetPriceOracle.selector,
                _marketId,
                _priceOracle
            )
        );

        emit SetMarketPaused(_marketId, false);
    }

    // ===================================================================
    // ============================ View Functions =======================
    // ===================================================================

    function isTokenPaused(
        address _token
    ) external view returns (bool) {
        return _tokenToPaused[_token];
    }

    function getPrice(
        address _token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_tokenToPaused[_token]) {
            return IDolomiteStructs.MonetaryPrice({
                value: 0
            });
        }

        return DOLOMITE_REGISTRY.oracleAggregator().getPrice(_token);
    }
}
