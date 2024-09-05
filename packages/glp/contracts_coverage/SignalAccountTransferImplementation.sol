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

import { IAccountTransferReceiver } from "./interfaces/IAccountTransferReceiver.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { ISignalAccountTransferImplementation } from "./interfaces/ISignalAccountTransferImplementation.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   SignalAccountTransferImplementation
 * @author  Dolomite
 *
 * @notice  Implementation contract to signal account transfers on GMX
 */
contract SignalAccountTransferImplementation is ISignalAccountTransferImplementation {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "SignalAccountTransferImpl";

    // ==================================================================
    // =========================== Public Functions =====================
    // ==================================================================

    function signalAccountTransfer(address _receiver, IGmxRegistryV1 _registry) external {
        // @follow-up Do we want to use safe approve? Normal approve seems fine in this case
        _registry.gmx().approve(address(_registry.sGmx()), type(uint256).max);
        IERC20(_registry.sbfGmx()).approve(_receiver, type(uint256).max);
        _registry.gmxRewardsRouter().signalTransfer(_receiver);
    }
}
