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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { VestingClaims } from "./VestingClaims.sol";
import { IRegularAirdrop } from "./interfaces/IRegularAirdrop.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";


/**
 * @title   StrategicVestingClaims
 * @author  Dolomite
 *
 * Strategic vesting claims contract for DOLO tokens
 */
contract StrategicVestingClaims is VestingClaims {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "StrategicVestingClaims";
    uint256 public constant ONE_MONTH = 30 days;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        uint256 _tgeTimestamp,
        uint256 _duration,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) VestingClaims(_dolo, _tgeTimestamp, _duration, _dolomiteRegistry, _dolomiteMargin) {
    }

    function _vestingSchedule(
        uint256 totalAllocation,
        uint64 timestamp
    ) internal view override returns (uint256) {
        uint256 startTimestamp = TGE_TIMESTAMP - ONE_MONTH;
        if (timestamp < TGE_TIMESTAMP) {
            return 0;
        } else if (timestamp >= startTimestamp + DURATION) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - startTimestamp)) / DURATION;
        }
    }
}
