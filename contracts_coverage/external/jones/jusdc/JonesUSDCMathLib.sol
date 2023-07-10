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

import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IJonesWhitelistController } from "../../interfaces/jones/IJonesWhitelistController.sol";


/**
 * @title   JonesUSDCMathLib
 * @author  Dolomite
 *
 * @notice  A library contract for calculating the retention fees
 */
library JonesUSDCMathLib {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "JonesUSDCMathLib";

    // ============================ Constructor ============================

    function getRetentionFee(
        IJonesUSDCRegistry _registry
    ) internal view returns (uint256 retentionFee, uint256 retentionFeeBase) {
        IJonesWhitelistController controller = _registry.whitelistController();
        bytes32 role = controller.getUserRole(_registry.unwrapperTrader());

        retentionFee = controller.getRoleInfo(role).jUSDC_RETENTION;
        retentionFeeBase = controller.BASIS_POINTS();
    }
}
