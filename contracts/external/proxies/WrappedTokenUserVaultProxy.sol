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
    IWrappedTokenUserVaultProxy
{

    // ============ Constants ============

    bytes32 constant FILE = "WrappedTokenUserVaultProxy";
    bytes32 constant IS_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isInitialized")) - 1);
    bytes32 constant VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);
    bytes32 constant OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);

    // ======== Modifiers =========

    modifier onlyOwner() {
        Require.that(msg.sender == owner(), FILE, "Caller is not the owner");
        _;
    }

    modifier requireIsInitialized() {
        Require.that(isInitialized(), FILE, "Not initialized");
        _;
    }

    // ============ Constructor ============

    constructor() {
        _setAddress(VAULT_FACTORY_SLOT, msg.sender);
    }

    // ============ Functions ============

    fallback() external onlyOwner requireIsInitialized {
        address _implementation = implementation();
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function initialize(
        address _account
    ) external {
        Require.that(
            !isInitialized(),
            FILE,
            "Already initialized"
        );
        _setUint256(IS_INITIALIZED_SLOT, 1);
        _setAddress(OWNER_SLOT, _account);
    }

    function implementation() public override view returns (address) {
        return IWrappedTokenUserVaultFactory(vaultFactory()).userVaultImplementation();
    }

    function isInitialized() public override view returns (bool) {
        return _getUint256(IS_INITIALIZED_SLOT) == 1;
    }

    function vaultFactory() public override view returns (address) {
        return _getAddress(VAULT_FACTORY_SLOT);
    }

    function owner() public override view returns (address) {
        return _getAddress(OWNER_SLOT);
    }

    // ================ Internal Functions ==================

    function _getAddress(bytes32 slot) internal view returns (address value) {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            value := sload(slot)
        }
    }

    function _getUint256(bytes32 slot) internal view returns (uint256 value) {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            value := sload(slot)
        }
    }

    function _setAddress(bytes32 slot, address _value) internal {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            sstore(slot, _value)
        }
    }

    function _setUint256(bytes32 slot, uint256 _value) internal {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            sstore(slot, _value)
        }
    }
}
