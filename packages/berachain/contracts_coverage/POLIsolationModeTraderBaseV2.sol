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
import { ILiquidatorAssetRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/ILiquidatorAssetRegistry.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";


/**
 * @title   POLIsolationModeTraderBaseV2
 * @author  Dolomite
 *
 * @notice  Abstract contract for selling a vault token into the underlying token. Must be set as a token converter by
 *          the DolomiteMargin admin on the corresponding `IsolationModeVaultFactory` token to be used.
 */
abstract contract POLIsolationModeTraderBaseV2 is OnlyDolomiteMargin, Initializable {

    // ======================== Constants ========================

    bytes32 private constant _FILE = "POLIsolationModeTraderBaseV2";
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);

    // ======================== Field Variables ========================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ========================= Modifiers =========================

    modifier onlyGenericTraderOrTrustedLiquidator(address _from) {
        _validateIsGenericTraderOrTrustedLiquidator(_from);
        _;
    }

    // ======================== Constructor ========================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // @follow-up look into how to chain these together and have one public function
    function initialize(
        address _vaultFactory
    )
    public
    initializer {
        _setAddress(_VAULT_FACTORY_SLOT, _vaultFactory);
    }

    function vaultFactory() public view returns (IIsolationModeVaultFactory) {
        return IIsolationModeVaultFactory(_getAddress(_VAULT_FACTORY_SLOT));
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
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(vaultFactory()));
        if (_isValidLiquidator(_from, marketId) || _from == address(DOLOMITE_REGISTRY.genericTraderProxy())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isValidLiquidator(_from, marketId) || _from == address(DOLOMITE_REGISTRY.genericTraderProxy()),
            _FILE,
            "Caller is not authorized",
            _from
        );
    }
}
