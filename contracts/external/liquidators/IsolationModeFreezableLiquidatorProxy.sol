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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
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
    uint256 private constant _BP_BASE = 10_000;

    // ========================= Immutable Fields ==========================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ========================= State Variables ==========================

    uint256 public minOutputPercentageUpperBound = 500;

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
        PrepareForLiquidationParams calldata _params
    )
        external
        payable
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_params.freezableMarketId)
    {
        address freezableToken = DOLOMITE_MARGIN.getMarketTokenAddress(_params.freezableMarketId);
        Require.that(
            IIsolationModeVaultFactory(freezableToken).getAccountByVault(_params.liquidAccount.owner) != address(0),
            _FILE,
            "Invalid liquid account",
            _params.liquidAccount.owner
        );
        MarketInfo[] memory marketInfos = _getMarketInfos(
            /* _solidMarketIds = */ new uint256[](0),
            DOLOMITE_MARGIN.getAccountMarketsWithBalances(_params.liquidAccount)
        );
        _checkIsLiquidatable(
            _params.liquidAccount,
            marketInfos,
            _params.outputMarketId,
            _params.expirationTimestamp
        );

        _checkMinAmountIsNotTooLarge(
            _params.freezableMarketId,
            _params.outputMarketId,
            _params.inputTokenAmount,
            _params.minOutputAmount
        );
    
        address outputToken = DOLOMITE_MARGIN.getMarketTokenAddress(_params.outputMarketId);
        IIsolationModeTokenVaultV1WithFreezable vault = IIsolationModeTokenVaultV1WithFreezable(_params.liquidAccount.owner);
        vault.initiateUnwrappingForLiquidation{value: msg.value}(
            _params.liquidAccount.number,
            _params.inputTokenAmount,
            outputToken,
            _params.minOutputAmount,
            _params.extraData
        );
    }

    function ownerSetMinOutputPercentageUpperBound(uint256 _minOutputPercentageUpperBound) external {
        Require.that(
            msg.sender == address(DOLOMITE_MARGIN),
            _FILE,
            'OnlyDolomiteMargin'
        );
        minOutputPercentageUpperBound = _minOutputPercentageUpperBound;
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
            Require.that(
                _expirationTimestamp == uint32(_expirationTimestamp),
                _FILE,
                "Invalid expiration timestamp"
            );
            Require.that(
                _expirationTimestamp <= block.timestamp,
                _FILE,
                "Account not expired"
            );
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
                DOLOMITE_MARGIN.getAccountMarketsWithBalances(_liquidAccount)
            );

            // Panic if there's no supply value
            Require.that(
                liquidSupplyValue.value != 0,
                _FILE,
                "Liquid account has no supply"
            );

            IDolomiteStructs.Decimal memory marginRatio = DOLOMITE_MARGIN.getMarginRatio();
            Require.that(
                DOLOMITE_MARGIN.getAccountStatus(_liquidAccount) == IDolomiteStructs.AccountStatus.Liquid
                    || !_isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio),
                _FILE,
                "Liquid account not liquidatable"
            );
        }
    }

    function _checkMinAmountIsNotTooLarge(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputTokenAmount,
        uint256 _minOutputAmount
    ) internal view {
        uint256 inputValue = DOLOMITE_MARGIN.getMarketPrice(_inputMarketId).value * _inputTokenAmount;
        uint256 outputValue = DOLOMITE_MARGIN.getMarketPrice(_outputMarketId).value * _minOutputAmount;
        
        IDolomiteMargin.Decimal memory spread = DOLOMITE_MARGIN.getLiquidationSpreadForPair(
            /* heldMarketId = */ _inputMarketId,
            /* ownedMarketId = */ _outputMarketId
        );
        uint256 inputValueAdj = inputValue - (inputValue * spread.value / 2e18);

        Require.that(
            outputValue <= inputValueAdj,
            _FILE,
            'minOutputAmount too large'
        );
    }
}
