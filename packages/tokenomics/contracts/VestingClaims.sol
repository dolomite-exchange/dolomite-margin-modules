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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IVestingClaims } from "./interfaces/IVestingClaims.sol";


/**
 * @title   VestingClaims
 * @author  Dolomite
 *
 * Vesting claims contract for DOLO tokens
 */
contract VestingClaims is BaseClaim, IVestingClaims {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VestingClaims";
    bytes32 private constant _VESTING_CLAIMS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vestingClaimsStorage")) - 1); // solhint-disable-line max-line-length

    uint256 public constant EPOCH_NUMBER = 0;
    uint256 public constant ONE_YEAR = 365 days;

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable DOLO;
    uint256 public immutable TGE_TIMESTAMP;
    uint256 public immutable DURATION;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        uint256 _tgeTimestamp,
        uint256 _duration,
        address _dolomiteRegistry
    ) BaseClaim(_dolomiteRegistry) {
        DOLO = IERC20(_dolo);
        TGE_TIMESTAMP = _tgeTimestamp;
        DURATION = _duration;
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(bytes32[] calldata _proof, uint256 _allocatedAmount) external {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        Require.that(
            _verifyMerkleProof(user, _proof, _allocatedAmount),
            _FILE,
            "Invalid merkle proof"
        );

        uint256 amount = releasable(_allocatedAmount, user);
        Require.that(
            amount > 0,
            _FILE,
            "No amount to claim"
        );
        s.released[user] += amount;

        DOLO.safeTransfer(msg.sender, amount);
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            user,
            EPOCH_NUMBER,
            amount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function released(address _user) external view returns (uint256) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        return s.released[_user];
    }

    function releasable(uint256 _totalAllocation, address _user) public view virtual returns (uint256) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();

        return _vestingSchedule(_totalAllocation, uint64(block.timestamp)) - s.released[_user];
    }

    function _vestingSchedule(
        uint256 _totalAllocation,
        uint64 _timestamp
    ) internal virtual view returns (uint256) {
        if (_timestamp < TGE_TIMESTAMP + ONE_YEAR) {
            return 0;
        } else if (_timestamp >= TGE_TIMESTAMP + DURATION) {
            return _totalAllocation;
        } else {
            return (_totalAllocation * (_timestamp - TGE_TIMESTAMP)) / DURATION;
        }
    }

    function _getVestingClaimsStorage() internal pure returns (VestingClaimsStorage storage vestingClaimsStorage) {
        bytes32 slot = _VESTING_CLAIMS_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            vestingClaimsStorage.slot := slot
        }
    }
}
