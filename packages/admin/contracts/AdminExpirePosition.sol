// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite

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
import { IExpirePositionProxy } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/IExpirePositionProxy.sol"; // solhint-disable-line max-line-length
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminExpirePosition
 * @author  Dolomite
 *
 * @notice  Contract that enables an admin to set an expiration for a user's position
 */
contract AdminExpirePosition is OnlyDolomiteMargin, AdminRegistryHelper {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminExpirePosition";

    bytes32 public constant ADMIN_EXPIRE_POSITION_ROLE = keccak256("AdminExpirePosition");
    address public immutable EXPIRE_POSITION_PROXY;

    // ===================================================================
    // =========================== Constructors ==========================
    // ===================================================================

    constructor(
        address _expirePositionProxy,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        EXPIRE_POSITION_PROXY = _expirePositionProxy;
    }

    // ===================================================================
    // ============================ Admin Functions ======================
    // ===================================================================

    function expirePositions(
        IExpirePositionProxy.ExpirePositionParams[] memory positions
    ) external checkPermission(this.expirePositions.selector, msg.sender) {

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            EXPIRE_POSITION_PROXY,
            abi.encodeWithSelector(
                IExpirePositionProxy.expirePositions.selector,
                positions
            )
        );
    }
}
