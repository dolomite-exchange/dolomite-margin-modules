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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IAccountTransferReceiver } from "./interfaces/IAccountTransferReceiver.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { ISignalAccountTransferImplementation } from "./interfaces/ISignalAccountTransferImplementation.sol";


/**
 * @title   AccountTransferReceiver
 * @author  Dolomite
 *
 * @notice  AccountTransferReceiver
 */
contract AccountTransferReceiver is IAccountTransferReceiver {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "AccountTransferReceiver";

    address public immutable VAULT;
    address public immutable OWNER;
    IGmxRegistryV1 public immutable REGISTRY;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyOwner() {
        if (msg.sender == OWNER) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == OWNER,
            _FILE,
            "Caller must be owner"
        );
        _;
    }

    // ==================================================================
    // =========================== Constructor ==========================
    // ==================================================================

    constructor(
        address _vault,
        address _owner,
        address _registry
    ) {
        VAULT = _vault;
        OWNER = _owner;
        REGISTRY = IGmxRegistryV1(_registry);

        REGISTRY.gmxRewardsRouter().acceptTransfer(_vault);
    }

    // ==================================================================
    // =========================== Public Functions =====================
    // ==================================================================

    function signalAccountTransfer(address _receiver) external onlyOwner {
        if (_receiver != VAULT) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _receiver != VAULT,
            _FILE,
            "Receiver cannot be vault"
        );

        ISignalAccountTransferImplementation impl = REGISTRY.signalAccountTransferImpl();
        Address.functionDelegateCall(
            address(impl),
            abi.encodeWithSelector(impl.signalAccountTransfer.selector, _receiver),
            "AccountTransferReceiver: Signal account transfer failed"
        );

        emit AccountTransferSignaled(_receiver);
    }
}
