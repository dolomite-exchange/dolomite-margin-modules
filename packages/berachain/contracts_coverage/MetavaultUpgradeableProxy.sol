// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IMetavaultUpgradeableProxy } from "./interfaces/IMetavaultUpgradeableProxy.sol";


/**
 * @title   MetavaultUpgradeableProxy
 * @author  Dolomite
 *
 * @notice  Abstract "implementation" (for an upgradeable proxy) contract for a berachain rewards metavault
 */
contract MetavaultUpgradeableProxy is
    IMetavaultUpgradeableProxy,
    ProxyContractHelpers
{
    using Address for address;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "MetavaultUpgradeableProxy";
    bytes32 private constant _IS_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isInitialized")) - 1);
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier requireIsInitialized() {
        if (isInitialized()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isInitialized(),
            _FILE,
            "Not initialized"
        );
        _;
    }

    // ==================================================================
    // =========================== Constructor ==========================
    // ==================================================================

    constructor() {
        _setAddress(_REGISTRY_SLOT, msg.sender);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    receive() external payable requireIsInitialized {
        _callImplementation(implementation());
    }

    // solhint-disable-next-line payable-fallback
    fallback() external payable requireIsInitialized {
        _callImplementation(implementation());
    }

    function initialize(
        address _vaultOwner
    ) external {
        if (!isInitialized()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !isInitialized(),
            _FILE,
            "Already initialized"
        );
        if (IBerachainRewardsRegistry(registry()).getAccountToMetavault(_vaultOwner) == address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            IBerachainRewardsRegistry(registry()).getAccountToMetavault(_vaultOwner) == address(this),
            _FILE,
            "Invalid account",
            _vaultOwner
        );
        _setAddress(_OWNER_SLOT, _vaultOwner);
        _setUint256(_IS_INITIALIZED_SLOT, 1);
    }

    function implementation() public override view returns (address) {
        return IBerachainRewardsRegistry(registry()).metavaultImplementation();
    }

    function isInitialized() public override view returns (bool) {
        return _getUint256(_IS_INITIALIZED_SLOT) == 1;
    }

    function registry() public override view returns (address) {
        return _getAddress(_REGISTRY_SLOT);
    }

    function owner() public override view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }
}
