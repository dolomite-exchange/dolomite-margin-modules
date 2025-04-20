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

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IBaseClaim } from "./IBaseClaim.sol";


/**
 * @title   IOptionAirdrop
 * @author  Dolomite
 *
 * @notice  Interface for DOLO option airdrop contract
 */
interface IOptionAirdrop is IBaseClaim {

    struct OptionAirdropStorage {
        address treasury;
        mapping(address => uint256) userToClaimedAmount;
        mapping(address => uint256) userToPurchases;

        EnumerableSet.UintSet allowedMarketIds;
    }

    // ======================================================
    // ======================== Events ======================
    // ======================================================

    event TreasurySet(address treasury);
    event AllowedMarketIdsSet(uint256[] marketIds);
    event RewardTokenWithdrawn(address token, uint256 amount, address receiver);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function claim(
        bytes32[] memory _proof,
        uint256 _allocatedAmount,
        uint256 _claimAmount,
        uint256 _marketId,
        uint256 _fromAccountNumber
    ) external;
}
