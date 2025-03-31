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
import { BaseClaim } from "./BaseClaim.sol";
import { IBaseClaim } from "./interfaces/IBaseClaim.sol";
import { IVestingClaims } from "./interfaces/IVestingClaims.sol";


/**
 * @title   VestingClaims
 * @author  Dolomite
 *
 * Vesting claims contract for DOLO tokens
 */
// TODO: change to use a traditional mapping with allocations instead of Merkle
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
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        DOLO = IERC20(_dolo);
        TGE_TIMESTAMP = _tgeTimestamp;
        DURATION = _duration;
    }

    // ==============================================================
    // ======================= Admin Functions =======================
    // ==============================================================

    function ownerSetAllocatedAmounts(
        address[] memory _users,
        uint256[] memory _allocatedAmounts
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _users.length == _allocatedAmounts.length,
            _FILE,
            "Invalid array lengths"
        );

        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        for (uint256 i = 0; i < _users.length; i++) {
            Require.that(
                s.allocatedAmount[_users[i]] == 0,
                _FILE,
                "User has allocated amount"
            );
            assert(s.released[_users[i]] == 0);
            s.allocatedAmount[_users[i]] = _allocatedAmounts[i];
            emit AllocatedAmountSet(_users[i], _allocatedAmounts[i]);
        }
    }

    function ownerRevokeInvestor(
        address _user,
        address _recipient
    ) external onlyDolomiteMarginOwner(msg.sender) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();

        uint256 amount = s.allocatedAmount[_user] - s.released[_user];

        s.allocatedAmount[_user] = 0;
        s.released[_user] = 0;
        _ownerClearAddressRemapping(_user);

        DOLO.safeTransfer(_recipient, amount);
        emit InvestorRevoked(_user, amount);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim() external onlyClaimEnabled {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        uint256 amount = releasable(s.allocatedAmount[user], user);
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

    function allocatedAmount(address _user) external view returns (uint256) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        return s.allocatedAmount[_user];
    }

    function released(address _user) external view returns (uint256) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();
        return s.released[_user];
    }

    function releasable(uint256 _totalAllocation, address _user) public view virtual returns (uint256) {
        VestingClaimsStorage storage s = _getVestingClaimsStorage();

        return _vestingSchedule(_totalAllocation, uint64(block.timestamp)) - s.released[_user];
    }

    function merkleRoot() public view override(BaseClaim, IBaseClaim) returns (bytes32) {
        revert("VestingClaims: Not implemented");
    }

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal override {
        revert("VestingClaims: Not implemented");
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
