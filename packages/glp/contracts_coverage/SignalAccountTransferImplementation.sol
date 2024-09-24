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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { ISignalAccountTransferImplementation } from "./interfaces/ISignalAccountTransferImplementation.sol";


/**
 * @title   SignalAccountTransferImplementation
 * @author  Dolomite
 *
 * @notice  Implementation contract to signal account transfers on GMX
 */
contract SignalAccountTransferImplementation is ISignalAccountTransferImplementation, ProxyContractHelpers {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "SignalAccountTransferImpl";
    bytes32 private constant _IS_IMPL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isImpl")) - 1);

    IGmxRegistryV1 public immutable REGISTRY;

    // ==================================================================
    // =========================== Public Functions =====================
    // ==================================================================

    constructor(IGmxRegistryV1 _registry) {
        REGISTRY = _registry;
        _setUint256(_IS_IMPL_SLOT, 1);
    }

    // ==================================================================
    // =========================== Public Functions =====================
    // ==================================================================

    function signalAccountTransfer(address _receiver) external {
        if (_getUint256(_IS_IMPL_SLOT) == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _getUint256(_IS_IMPL_SLOT) == 0,
            _FILE,
            "Only usable via delegate call"
        );


        REGISTRY.gmx().safeApprove(address(REGISTRY.sGmx()), type(uint256).max);
        IERC20(REGISTRY.sbfGmx()).safeApprove(_receiver, type(uint256).max);
        REGISTRY.gmxRewardsRouter().signalTransfer(_receiver);
    }
}
