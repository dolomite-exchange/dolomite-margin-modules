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

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { BaseLiquidatorProxy } from "../general/BaseLiquidatorProxy.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "../interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";


/**
 * @title   IsolationModeFreezableLiquidatorProxy
 * @author  Dolomite
 *
 * @notice  Liquidator for handling the GMX V2 (GM) tokens and other freezable vaults.
 */
contract IsolationModeFreezableLiquidatorProxy is BaseLiquidatorProxy, ReentrancyGuard {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "FreezableVaultLiquidatorProxy";

    // ========================= Immutable Fields ==========================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin,
        address _expiry,
        address _liquidatorAssetRegistry
    )
    BaseLiquidatorProxy(
        _dolomiteMargin,
        _expiry,
        _liquidatorAssetRegistry
    ) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function prepareForLiquidation(
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        uint256 _freezableMarketId,
        uint256 _inputTokenAmount,
        uint256 _outputMarketId,
        uint256 _minOutputAmount,
        uint256 _expirationTimestamp
    )
        external
        payable
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_freezableMarketId)
    {
        address freezableToken = DOLOMITE_MARGIN.getMarketTokenAddress(_freezableMarketId);
        if (IIsolationModeVaultFactory(freezableToken).getAccountByVault(_liquidAccount.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(IIsolationModeVaultFactory(freezableToken).getAccountByVault(_liquidAccount.owner) != address(0),
            _FILE,
            "Invalid liquid account",
            _liquidAccount.owner
        );
        MarketInfo[] memory marketInfos = _getMarketInfos(
            /* _solidMarketIds = */ new uint256[](0),
            DOLOMITE_MARGIN.getAccountMarketsWithBalances(_liquidAccount)
        );
        _checkIsLiquidatable(
            _liquidAccount,
            marketInfos,
            _outputMarketId,
            _expirationTimestamp
        );

        address outputToken = DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarketId);
        IIsolationModeTokenVaultV1WithFreezable vault = IIsolationModeTokenVaultV1WithFreezable(_liquidAccount.owner);
        if (!vault.isVaultAccountFrozen(_liquidAccount.number)) { /* FOR COVERAGE TESTING */ }
        Require.that(!vault.isVaultAccountFrozen(_liquidAccount.number),
            _FILE,
            "Account is frozen",
            _liquidAccount.owner,
            _liquidAccount.number
        );
        vault.initiateUnwrappingForLiquidation{value: msg.value}(
            _liquidAccount.number,
            _inputTokenAmount,
            outputToken,
            _minOutputAmount
        );

        DOLOMITE_REGISTRY.emitLiquidationEnqueued(
            _liquidAccount.owner,
            _liquidAccount.number,
            _freezableMarketId,
            _inputTokenAmount,
            _outputMarketId,
            _minOutputAmount
        );
    }

    // ======================================================================
    // ========================= Internal Functions =========================
    // ======================================================================

    function _checkIsLiquidatable(
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        MarketInfo[] memory _marketInfos,
        uint256 _outputMarketId,
        uint256 _expirationTimestamp
    ) internal view {
        if (_expirationTimestamp != 0) {
            if (_expirationTimestamp == uint32(_expirationTimestamp)) { /* FOR COVERAGE TESTING */ }
            Require.that(_expirationTimestamp == uint32(_expirationTimestamp),
                _FILE,
                "Invalid expiration timestamp"
            );
            if (_expirationTimestamp <= block.timestamp) { /* FOR COVERAGE TESTING */ }
            Require.that(_expirationTimestamp <= block.timestamp,
                _FILE,
                "Account not expired"
            );
            if (EXPIRY.getExpiry(_liquidAccount, _outputMarketId) == uint32(_expirationTimestamp)) { /* FOR COVERAGE TESTING */ }
            Require.that(EXPIRY.getExpiry(_liquidAccount, _outputMarketId) == uint32(_expirationTimestamp),
                _FILE,
                "Expiration mismatch"
            );
        } else {
            // Check the account is under water
            (
                IDolomiteStructs.MonetaryValue memory liquidSupplyValue,
                IDolomiteStructs.MonetaryValue memory liquidBorrowValue
            ) = _getAdjustedAccountValues(
                _marketInfos,
                _liquidAccount,
                DOLOMITE_MARGIN.getAccountMarketsWithBalances(_liquidAccount)
            );

            // Panic if there's no supply value
            if (liquidSupplyValue.value != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(liquidSupplyValue.value != 0,
                _FILE,
                "Liquid account has no supply"
            );

            IDolomiteStructs.Decimal memory marginRatio = DOLOMITE_MARGIN.getMarginRatio();
            if (DOLOMITE_MARGIN.getAccountStatus(_liquidAccount) == IDolomiteStructs.AccountStatus.Liquid|| !_isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio)) { /* FOR COVERAGE TESTING */ }
            Require.that(DOLOMITE_MARGIN.getAccountStatus(_liquidAccount) == IDolomiteStructs.AccountStatus.Liquid
                    || !_isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio),
                _FILE,
                "Liquid account not liquidatable"
            );
        }
    }
}
