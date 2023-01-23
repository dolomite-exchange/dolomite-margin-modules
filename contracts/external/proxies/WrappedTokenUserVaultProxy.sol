// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";

import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";


/**
 * @title WrappedTokenUserVault
 * @author Dolomite
 *
 * @notice  Abstract "implementation" (for an upgradeable proxy) contract for wrapping tokens via a per-user vault that
 *          can be used with DolomiteMargin
 */
contract WrappedTokenUserVaultProxy is
    IWrappedTokenUserVaultProxy,
    ProxyContractHelpers
{

    // ============ Constants ============

    bytes32 private constant _FILE = "WrappedTokenUserVaultProxy";
    bytes32 private constant _IS_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isInitialized")) - 1);
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);

    // ======== Modifiers =========

    modifier requireIsInitialized() {
        Require.that(isInitialized(), _FILE, "Not initialized");
        _;
    }

    // ============ Constructor ============

    constructor() {
        _setAddress(_VAULT_FACTORY_SLOT, msg.sender);
    }

    // ============ Functions ============

    // solhint-disable-next-line payable-fallback
    fallback() external requireIsInitialized {
        _callImplementation(implementation());
    }

    function initialize(
        address _account
    ) external {
        Require.that(
            !isInitialized(),
            _FILE,
            "Already initialized"
        );
        Require.that(
            IWrappedTokenUserVaultFactory(vaultFactory()).getVaultByAccount(_account) == address(this),
            _FILE,
            "Invalid account",
            _account
        );
        _setUint256(_IS_INITIALIZED_SLOT, 1);
        _setAddress(_OWNER_SLOT, _account);
    }

    function implementation() public override view returns (address) {
        return IWrappedTokenUserVaultFactory(vaultFactory()).userVaultImplementation();
    }

    function isInitialized() public override view returns (bool) {
        return _getUint256(_IS_INITIALIZED_SLOT) == 1;
    }

    function vaultFactory() public override view returns (address) {
        return _getAddress(_VAULT_FACTORY_SLOT);
    }

    function owner() public override view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }
}
