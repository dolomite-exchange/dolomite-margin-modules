// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IFeeRebateClaimer } from "./interfaces/IFeeRebateClaimer.sol";
import { IFeeRebateRollingClaims } from "./interfaces/IFeeRebateRollingClaims.sol";


/**
 * @title   FeeRebateRollingClaims
 * @author  Dolomite
 *
 * Claim contract for fee rebates for veDOLO holders
 */
contract FeeRebateRollingClaims is BaseClaim, IFeeRebateRollingClaims {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteStructs.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "FeeRebateRollingClaims";
    bytes32 private constant _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.feeRebateRollingClaimsStorage")) - 1); // solhint-disable-line max-line-length

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        _disableInitializers();
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function initialize(address _feeRebateClaimer) external initializer {
        super.initialize();
        _ownerSetFeeRebateClaimer(_feeRebateClaimer);

        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();

        uint256 epoch = IFeeRebateClaimer(_feeRebateClaimer).currentEpoch();
        $.currentEpoch = uint96(epoch);
        emit EpochSet(epoch);
    }

    function handlerSetMerkleRoots(
        uint256[] calldata _marketIds,
        bytes32[] calldata _merkleRoots,
        uint256[] calldata _totalAmounts,
        uint256 _expectedEpoch
    ) external onlyHandler(msg.sender) {
        Require.that(
            _marketIds.length == _merkleRoots.length && _merkleRoots.length == _totalAmounts.length,
            _FILE,
            "Lengths not aligned"
        );
        Require.that(
            _marketIds.length != 0,
            _FILE,
            "Lengths cannot be 0"
        );
        Require.that(
            _getFeeRebateRollingClaimsStorage().currentEpoch + 1 == _expectedEpoch,
            _FILE,
            "Invalid epoch"
        );

        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: $.feeRebateClaimer,
            number: 0
        });
        for (uint256 i; i < _marketIds.length; i++) {
            IDolomiteStructs.Wei memory balance = DOLOMITE_MARGIN().getAccountWei(account, _marketIds[i]);
            Require.that(
                balance.isZero() || balance.isPositive(),
                _FILE,
                "Fee claimer invalid balance"
            );
            Require.that(
                _totalAmounts[i] - $.marketIdToMarket[_marketIds[i]].claimAmount < balance.value,
                _FILE,
                "Invalid total amount"
            );
            _ownerSetMarketIdToMerkleRoot(_marketIds[i], _merkleRoots[i], _totalAmounts[i]);
        }

        $.currentEpoch = uint96(_expectedEpoch);
        emit EpochSet(_expectedEpoch);
    }

    // ======================================================
    // ================== Public Functions ==================
    // ======================================================

    function claim(ClaimParams[] calldata _claimParams) external onlyClaimEnabled nonReentrant {
        for (uint256 i = 0; i < _claimParams.length; i++) {
            _claim(_claimParams[i]);
        }
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function marketIdToClaimAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.marketIdToMarket[_marketId].claimAmount;
    }

    function marketIdToTotalAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.marketIdToMarket[_marketId].totalAmount;
    }

    function marketIdToRemainingAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        MarketStorage storage market = $.marketIdToMarket[_marketId];
        return market.totalAmount - market.claimAmount;
    }

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.marketIdToMarket[_marketId].merkleRoot;
    }

    function userToMarketIdToClaimAmount(address _user, uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.userToMarketIdToClaimAmount[_user][_marketId];
    }

    function userToMarketIdToClaimAmounts(
        address _user,
        uint256[] calldata _marketIds
    ) external view returns (uint256[] memory) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        uint256[] memory result = new uint256[](_marketIds.length);
        for (uint256 i; i < _marketIds.length; ++i) {
            result[i] = $.userToMarketIdToClaimAmount[_user][_marketIds[i]];
        }

        return result;
    }

    function feeRebateClaimer() public view returns (address) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.feeRebateClaimer;
    }

    function currentEpoch() public view returns (uint256) {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        return $.currentEpoch;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _claim(ClaimParams memory _claimParams) internal {
        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);
        MarketStorage storage market = $.marketIdToMarket[_claimParams.marketId];

        Require.that(
            _verifyMerkleProof(
                user,
                market.merkleRoot,
                _claimParams.proof,
                _claimParams.amount
            ),
            _FILE,
            "Invalid merkle proof",
            _claimParams.marketId
        );
        Require.that(
            _claimParams.amount > $.userToMarketIdToClaimAmount[user][_claimParams.marketId],
            _FILE,
            "No amount to claim"
        );

        // We subtract these two because `_claimParams.amount` is the ever-increasing aggregate of all claims
        uint256 amountToClaim = _claimParams.amount - $.userToMarketIdToClaimAmount[user][_claimParams.marketId];
        $.userToMarketIdToClaimAmount[user][_claimParams.marketId] = _claimParams.amount;

        market.claimAmount += uint128(amountToClaim);

        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            $.feeRebateClaimer,
            /* fromAccountNumber = */ 0,
            /* toAccountOwner = */ msg.sender,
            /* toAccountNumber = */ 0,
            _claimParams.marketId,
            IDolomiteStructs.AssetDenomination.Wei,
            amountToClaim,
            AccountBalanceLib.BalanceCheckFlag.From
        );

        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(user, _claimParams.marketId, amountToClaim);
    }

    function _ownerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot, uint256 _newTotal) internal virtual {
        Require.that(
            _merkleRoot != bytes32(0),
            _FILE,
            "Invalid merkle root"
        );
        Require.that(
            _newTotal == uint128(_newTotal) && _newTotal != 0,
            _FILE,
            "Invalid new total"
        );

        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        $.marketIdToMarket[_marketId].totalAmount = uint128(_newTotal);
        $.marketIdToMarket[_marketId].merkleRoot = _merkleRoot;
        emit MarketIdToMerkleRootSet(_marketId, _merkleRoot, _newTotal);
    }

    function _ownerSetFeeRebateClaimer(address _feeRebateClaimer) internal virtual {
        Require.that(
            _feeRebateClaimer != address(0),
            _FILE,
            "Invalid fee rebate address"
        );

        FeeRebateRollingClaimsStorage storage $ = _getFeeRebateRollingClaimsStorage();
        $.feeRebateClaimer = _feeRebateClaimer;
        emit FeeRebateClaimerSet(_feeRebateClaimer);
    }

    function _verifyMerkleProof(
        address _user,
        bytes32 _merkleRoot,
        bytes32[] memory _proof,
        uint256 _amount
    ) internal pure returns (bool) {
        bytes32 leaf = keccak256(abi.encode(_user, _amount));
        return MerkleProof.verify(_proof, _merkleRoot, leaf);
    }

    function _getFeeRebateRollingClaimsStorage(
    ) internal pure returns (FeeRebateRollingClaimsStorage storage feeRebateRollingClaimsStorage) {
        bytes32 slot = _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT;
        assembly {
            feeRebateRollingClaimsStorage.slot := slot
        }
    }
}
