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

import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { ILiquidatorAssetRegistry } from "../../interfaces/ILiquidatorAssetRegistry.sol";


/**
 * @title   IsolationModeTraderBaseV2
 * @author  Dolomite
 *
 * @notice  Abstract contract for selling a vault token into the underlying token. Must be set as a token converter by
 *          the DolomiteMargin admin on the corresponding `IsolationModeVaultFactory` token to be used.
 */
abstract contract IsolationModeTraderBaseV2 is OnlyDolomiteMargin {

    // ======================== Constants ========================

    bytes32 private constant _FILE = "IsolationModeTraderBaseV2";

    // ======================== Field Variables ========================

    IIsolationModeVaultFactory public immutable VAULT_FACTORY; // solhint-disable-line var-name-mixedcase
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ========================= Modifiers =========================

    modifier onlyGenericTraderOrTrustedLiquidator(address _from) {
        _validateIsGenericTraderOrTrustedLiquidator(_from);
        _;
    }

    // ======================== Constructor ========================

    constructor(
        address _vaultFactory,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        VAULT_FACTORY = IIsolationModeVaultFactory(_vaultFactory);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================= Internal Functions ========================

    function _isValidLiquidator(
        address _from,
        uint256 _marketId
    ) internal view returns (bool) {
        ILiquidatorAssetRegistry liquidatorRegistry = DOLOMITE_REGISTRY.liquidatorAssetRegistry();
        return liquidatorRegistry.isAssetWhitelistedForLiquidation(_marketId, _from)
            && liquidatorRegistry.getLiquidatorsForAsset(_marketId).length > 0;
    }

    // ========================= Private Functions ========================

    function _validateIsGenericTraderOrTrustedLiquidator(address _from) private view {
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(VAULT_FACTORY));
        if (_isValidLiquidator(_from, marketId) || _from == address(DOLOMITE_REGISTRY.genericTraderProxy())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isValidLiquidator(_from, marketId) || _from == address(DOLOMITE_REGISTRY.genericTraderProxy()),
            _FILE,
            "Caller is not authorized",
            _from
        );
    }
}
