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
import { BaseLiquidatorProxy } from "./BaseLiquidatorProxy.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeFreezableLiquidatorProxy } from "../isolation-mode/interfaces/IIsolationModeFreezableLiquidatorProxy.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1WithAsyncFreezable } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1WithAsyncFreezable.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   IsolationModeFreezableLiquidatorProxy
 * @author  Dolomite
 *
 * @notice  Liquidator for handling the GMX V2 (GM) tokens and other freezable vaults.
 */
contract IsolationModeFreezableLiquidatorProxy is
    IIsolationModeFreezableLiquidatorProxy,
    BaseLiquidatorProxy,
    ReentrancyGuard
{
    using DolomiteMarginVersionWrapperLib for *;

    // ============================ Constants ============================

    bytes32 private constant _FILE = "FreezableVaultLiquidatorProxy";
    uint256 private constant _BP_BASE = 10_000;

    // ========================= Immutable Fields ==========================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteAccountRiskOverride,
        address _liquidatorAssetRegistry,
        address _dolomiteMargin,
        address _expiry,
        uint256 _chainId
    )
    BaseLiquidatorProxy(
        _dolomiteAccountRiskOverride,
        _liquidatorAssetRegistry,
        _dolomiteMargin,
        _expiry,
        _chainId
    ) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function prepareForLiquidation(
        PrepareForLiquidationParams calldata _params
    )
        external
        payable
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_params.freezableMarketId)
    {
        address freezableToken = DOLOMITE_MARGIN().getMarketTokenAddress(_params.freezableMarketId);
        if (IIsolationModeVaultFactory(freezableToken).getAccountByVault(_params.liquidAccount.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            IIsolationModeVaultFactory(freezableToken).getAccountByVault(_params.liquidAccount.owner) != address(0),
            _FILE,
            "Invalid liquid account",
            _params.liquidAccount.owner
        );
        MarketInfo[] memory marketInfos = _getMarketInfos(
            /* _solidMarketIds = */ new uint256[](0),
            DOLOMITE_MARGIN().getAccountMarketsWithBalances(_params.liquidAccount)
        );
        _checkIsLiquidatable(
            _params.liquidAccount,
            marketInfos,
            _params.outputMarketId,
            _params.expirationTimestamp
        );

        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_params.outputMarketId);
        IIsolationModeTokenVaultV1WithAsyncFreezable vault = IIsolationModeTokenVaultV1WithAsyncFreezable(
            _params.liquidAccount.owner
        );
        vault.initiateUnwrappingForLiquidation{value: msg.value}(
            _params.liquidAccount.number,
            _params.inputTokenAmount,
            outputToken,
            _params.minOutputAmount,
            _params.extraData
        );
    }

    // ======================================================================
    // ========================= Internal Functions =========================
    // ======================================================================

    function _checkIsLiquidatable(
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        MarketInfo[] memory _marketInfos,
        uint256 _outputMarketId,
        uint256 _expirationTimestamp
    ) internal view {
        if (_expirationTimestamp != 0) {
            if (_expirationTimestamp == uint32(_expirationTimestamp)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _expirationTimestamp == uint32(_expirationTimestamp),
                _FILE,
                "Invalid expiration timestamp"
            );
            if (_expirationTimestamp <= block.timestamp) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _expirationTimestamp <= block.timestamp,
                _FILE,
                "Account not expired"
            );
            if (EXPIRY.getExpiry(_liquidAccount, _outputMarketId) == uint32(_expirationTimestamp)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                EXPIRY.getExpiry(_liquidAccount, _outputMarketId) == uint32(_expirationTimestamp),
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
                DOLOMITE_MARGIN().getAccountMarketsWithBalances(_liquidAccount),
                IDolomiteStructs.Decimal({ value: 0 })
            );

            // Panic if there's no supply value
            if (liquidSupplyValue.value != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                liquidSupplyValue.value != 0,
                _FILE,
                "Liquid account has no supply"
            );
            _checkIsLiquidatable(_liquidAccount, liquidSupplyValue, liquidBorrowValue);
        }
    }

    function _checkIsLiquidatable(
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        IDolomiteStructs.MonetaryValue memory _liquidSupplyValue,
        IDolomiteStructs.MonetaryValue memory _liquidBorrowValue
    ) internal view {
        IDolomiteStructs.Decimal memory marginRatio = DOLOMITE_MARGIN().getMarginRatio();
        if (DOLOMITE_MARGIN().getAccountStatus(_liquidAccount) == IDolomiteStructs.AccountStatus.Liquid || !_isCollateralized(_liquidSupplyValue.value, _liquidBorrowValue.value, marginRatio)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getAccountStatus(_liquidAccount) == IDolomiteStructs.AccountStatus.Liquid
                || !_isCollateralized(_liquidSupplyValue.value, _liquidBorrowValue.value, marginRatio),
            _FILE,
            "Liquid account not liquidatable"
        );
    }
}
