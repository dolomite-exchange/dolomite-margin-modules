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

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Require } from "../protocol/lib/Require.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";


/**
 * @title   RegistryProxy
 * @author  Dolomite
 *
 * @notice  Base contract for registry contracts. Contains helpers for validating address changes
 */
contract RegistryProxy is ProxyContractHelpers, OnlyDolomiteMarginForUpgradeable {

    // ===================== Constants =====================

    bytes32 private constant _FILE = "RegistryProxy";
    bytes32 private constant _IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    // ===================== Events =====================

    event ImplementationSet(address indexed implementation);

    // ==================== Constructor ====================

    constructor(
        address _implementation,
        address _dolomiteMargin,
        bytes memory _initializationCalldata
    ) {
        _setImplementation(_implementation);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
        Address.functionDelegateCall(
            implementation(),
            _initializationCalldata,
            "RegistryProxy: Initialization failed"
        );
    }

    // ===================== Functions =====================

    fallback() external {
        // solhint-disable-previous-line payable-fallback
        _callImplementation(implementation());
    }

    function upgradeTo(address _newImplementation) external onlyDolomiteMarginOwner(msg.sender) {
        _setImplementation(_newImplementation);
    }

    function upgradeToAndCall(
        address _newImplementation,
        bytes calldata _upgradeCalldata
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _setImplementation(_newImplementation);
        Address.functionDelegateCall(implementation(), _upgradeCalldata, "RegistryProxy: Upgrade failed");
    }

    function implementation() public view returns (address) {
        return _getAddress(_IMPLEMENTATION_SLOT);
    }

    // ===================== Internal Functions =====================

    function _setImplementation(address _newImplementation) internal {
        Require.that(
            Address.isContract(_newImplementation),
            _FILE,
            "Implementation is not a contract"
        );

        _setAddress(_IMPLEMENTATION_SLOT, _newImplementation);
        emit ImplementationSet(_newImplementation);
    }
}
