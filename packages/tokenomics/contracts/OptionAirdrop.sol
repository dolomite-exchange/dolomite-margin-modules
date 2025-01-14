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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IOptionAirdrop } from "./interfaces/IOptionAirdrop.sol";


/**
 * @title   OptionAirdrop
 * @author  Dolomite
 *
 * Option airdrop contract for DOLO tokens
 */
contract OptionAirdrop is OnlyDolomiteMargin, ReentrancyGuard, BaseClaim, IOptionAirdrop {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "OptionAirdrop";
    bytes32 private constant _OPTION_AIRDROP_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.optionAirdropStorage")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    uint256 public constant DOLO_PRICE = 0.03125 ether;

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable DOLO; // solhint-disable-line mixed-case

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _treasury,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        DOLO = IERC20(_dolo);

        _ownerSetTreasury(_treasury);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetAllowedMarketIds(
        uint256[] memory _marketIds
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowedMarketIds(_marketIds);
    }

    function ownerSetTreasury(address _treasury) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetTreasury(_treasury);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(
        bytes32[] calldata _proof,
        uint256 _allocatedAmount,
        uint256 _claimAmount,
        uint256 _marketId,
        uint256 _fromAccountNumber
    ) external nonReentrant {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        address user = addressRemapping(msg.sender) == address(0) ? msg.sender : addressRemapping(msg.sender);

        // @audit @Corey, double check all uses of user vs msg.sender
        Require.that(
            _verifyMerkleProof(user, _proof, _allocatedAmount),
            _FILE,
            "Invalid merkle proof"
        );
        Require.that(
            s.allowedMarketIds.contains(_marketId),
            _FILE,
            "Payment asset not allowed"
        );
        Require.that(
            s.userToClaimedAmount[user] + _claimAmount <= _allocatedAmount,
            _FILE,
            "Insufficient allocated amount"
        );
        s.userToClaimedAmount[user] += _claimAmount;


        uint256 doloValue = DOLO_PRICE * _claimAmount;
        uint256 paymentAmount = doloValue / DOLOMITE_MARGIN().getMarketPrice(_marketId).value;
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            s.treasury,
            _DEFAULT_ACCOUNT_NUMBER,
            _marketId,
            IDolomiteStructs.AssetDenomination.Wei,
            paymentAmount,
            AccountBalanceLib.BalanceCheckFlag.From
        );

        DOLO.safeTransfer(msg.sender, _claimAmount);
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            user,
            s.userToPurchases[user]++,
            _claimAmount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function isAllowedMarketId(uint256 _marketId) external view returns (bool) {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        return s.allowedMarketIds.contains(_marketId);
    }

    function getAllowedMarketIds() external view returns (uint256[] memory) {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        return s.allowedMarketIds.values();
    }

    function treasury() external view returns (address) {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        return s.treasury;
    }

    function userToClaimedAmount(address _user) external view returns (uint256) {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        return s.userToClaimedAmount[_user];
    }

    function userToPurchases(address _user) external view returns (uint256) {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        return s.userToPurchases[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAllowedMarketIds(uint256[] memory _marketIds) internal {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();

        // Clear out current set
        uint256 len = s.allowedMarketIds.length();
        for (uint256 i; i < len; i++) {
            s.allowedMarketIds.remove(s.allowedMarketIds.at(0));
        }

        len = _marketIds.length;
        for (uint256 i; i < len; i++) {
            s.allowedMarketIds.add(_marketIds[i]);
        }
        emit AllowedMarketIdsSet(_marketIds);
    }

    function _ownerSetTreasury(address _treasury) internal {
        OptionAirdropStorage storage s = _getOptionAirdropStorage();
        s.treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function _getOptionAirdropStorage() internal pure returns (OptionAirdropStorage storage optionAirdropStorage) {
        bytes32 slot = _OPTION_AIRDROP_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            optionAirdropStorage.slot := slot
        }
    }
}
