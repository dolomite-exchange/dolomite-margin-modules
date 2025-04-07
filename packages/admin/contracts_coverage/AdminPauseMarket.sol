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
import { IAdminPauseMarket } from "./interfaces/IAdminPauseMarket.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminPauseMarket
 * @author  Dolomite
 *
 * @notice  Contract that enables an admin to completely pause a market
 */
contract AdminPauseMarket is OnlyDolomiteMargin, IDolomitePriceOracle, IAdminPauseMarket {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminPauseMarket";

    // ===================================================================
    // ========================= State Variables =========================
    // ===================================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    mapping(address => bool) public tokenToPaused;
    mapping(address => bool) public trustedCallers;

    // ===================================================================
    // ============================ Modifiers ============================
    // ===================================================================

    modifier onlyTrustedCaller(address _sender) {
        if (trustedCallers[_sender]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            trustedCallers[_sender],
            _FILE,
            "Sender is not trusted caller"
        );
        _;
    }


    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ===================================================================
    // ============================ Admin Functions ======================
    // ===================================================================

    function ownerSetTrustedCaller(
        address _trustedCaller,
        bool _trusted
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_trustedCaller != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _trustedCaller != address(0),
            _FILE,
            "Caller is zero address"
        );

        trustedCallers[_trustedCaller] = _trusted;
        emit TrustedCallerSet(_trustedCaller, _trusted);
    }

    function pauseMarket(uint256 _marketId) external onlyTrustedCaller(msg.sender) {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        if (!tokenToPaused[token]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !tokenToPaused[token],
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

        tokenToPaused[token] = true;
        emit MarketPaused(_marketId);
    }

    function unpauseMarket(
        uint256 _marketId,
        address _priceOracle
    ) external onlyTrustedCaller(msg.sender) {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        if (_priceOracle != address(0) && tokenToPaused[token]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _priceOracle != address(0) && tokenToPaused[token],
            _FILE,
            "Invalid parameters"
        );
        tokenToPaused[token] = false;

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetPriceOracle.selector,
                _marketId,
                _priceOracle
            )
        );

        emit MarketUnpaused(_marketId);
    }

    // ===================================================================
    // ============================ View Functions =======================
    // ===================================================================

    function getPrice(
        address _token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        if (tokenToPaused[_token]) {
            return IDolomiteStructs.MonetaryPrice({
                value: 0
            });
        }

        return DOLOMITE_REGISTRY.oracleAggregator().getPrice(_token);
    }
}
