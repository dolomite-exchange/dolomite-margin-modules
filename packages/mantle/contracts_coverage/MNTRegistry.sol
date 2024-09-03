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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IMNTRegistry } from "./interfaces/IMNTRegistry.sol";
import { IMantleRewardStation } from "./interfaces/IMantleRewardStation.sol";



/**
 * @title   MNTRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the MNT-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Arbitrum introduces.
 */
contract MNTRegistry is IMNTRegistry, BaseRegistry {

    // ==================== Constants ====================

    // solhint-disable max-line-length
    bytes32 private constant _FILE = "MNTRegistry";
    bytes32 private constant _MANTLE_REWARD_STATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.mantleRewardStation")) - 1);
    // solhint-enable max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _dolomiteRegistry,
        address _mantleRewardStation
    ) external initializer {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
        _ownerSetMantleRewardStation(_mantleRewardStation);
    }

    function ownerSetMantleRewardStation(
        address _mantleRewardStation
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMantleRewardStation(_mantleRewardStation);
    }

    function mantleRewardStation() external view returns (IMantleRewardStation) {
        return IMantleRewardStation(_getAddress(_MANTLE_REWARD_STATION_SLOT));
    }

    // ==================== Internal Functions =========================

    function _ownerSetMantleRewardStation(address _mantleRewardStation) internal {
        Require.that(
            _mantleRewardStation != address(0),
            _FILE,
            "Invalid reward station address"
        );
        _setAddress(_MANTLE_REWARD_STATION_SLOT, _mantleRewardStation);
        emit MantleRewardStationSet(_mantleRewardStation);
    }
}
