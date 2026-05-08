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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IExpirePositionProxy } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/IExpirePositionProxy.sol"; // solhint-disable-line max-line-length
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { IAdminExpirePosition } from "./interfaces/IAdminExpirePosition.sol";


/**
 * @title   AdminExpirePosition
 * @author  Dolomite
 *
 * @notice  Contract that enables an admin to set an expiration for a user's position
 */
contract AdminExpirePosition is OnlyDolomiteMargin, AdminRegistryHelper, IAdminExpirePosition {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminExpirePosition";

    bytes32 public constant ADMIN_EXPIRE_POSITION_ROLE = keccak256("AdminExpirePosition");
    address public immutable EXPIRY;

    // ===================================================================
    // =========================== Constructors ==========================
    // ===================================================================

    constructor(
        address _expiry,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        EXPIRY = _expiry;
    }

    // ===================================================================
    // ============================ Admin Functions ======================
    // ===================================================================

    function expirePositions(
        ExpirePositionParams[] memory positions
    ) external checkPermission(this.expirePositions.selector, msg.sender) {
        uint256 positionLen = positions.length;
        uint256 actionsLen;

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](positionLen);
        for (uint256 i; i < positionLen; ++i) {
            accounts[i] = positions[i].account;
            actionsLen += positions[i].owedMarkets.length;
        }

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](actionsLen);
        uint256 actionsCursor;

        for (uint256 i; i < positionLen; ++i) {
            ExpirePositionParams memory position = positions[i];

            for (uint256 j; j < position.owedMarkets.length; ++j) {
                actions[actionsCursor++] = AccountActionLib.encodeExpirationAction(
                    position.account,
                    /* accountId = */ i,
                    position.owedMarkets[j],
                    address(EXPIRY),
                    /* _expiryTimeDelta = */ position.expirationTimestamp - block.timestamp
                );
            }
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }
}
