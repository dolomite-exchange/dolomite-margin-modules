//// SPDX-License-Identifier: GPL-3.0-or-later
///*
//
//    Copyright 2023 Dolomite
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//*/
//
//pragma solidity ^0.8.9;
//
//import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
//import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
//import { Require } from "../../protocol/lib/Require.sol";
//import { TypesLib } from "../../protocol/lib/TypesLib.sol";
//import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
//import { AccountActionLib } from "../lib/AccountActionLib.sol";
//import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
//import { IDolomiteChef } from "../interfaces/IDolomiteChef.sol";
//
//
//contract DolomiteChef is IDolomiteChef, OnlyDolomiteMargin, Pausable {
//    using AccountActionLib for IDolomiteMargin;
//    using InterestIndexLib for IDolomiteMargin.Par;
//    using TypesLib for IDolomiteMargin.Par;
//
//    // ==================================================
//    // =================== Constants ====================
//    // ==================================================
//
//    bytes32 private constant _FILE = "DolomiteChef";
//    uint256 private constant MUL_CONSTANT = 1e18;
//
//    // ==================================================
//    // =============== Immutable Storage ================
//    // ==================================================
//
//    uint256 public immutable STAKING_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
//    uint256 public immutable REWARD_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
//
//    // ==================================================
//    // ==================== Storage =====================
//    // ==================================================
//
//    address public operator;
//
//    IDolomiteMargin.Wei public rewardTokenPerSecondWei;
//    IDolomiteMargin.Par public accumulatedRewardTokenPerSharePar;
//    IDolomiteMargin.Par public totalSharesStakedPar;
//    uint32 public lastRewardUpdatedTimestamp;
//
//    mapping(address => UserInfo) public userInfo;
//
//    constructor(
//        uint256 _stakingTokenMarketId,
//        uint256 _rewardTokenMarketId,
//        uint256 _startTimestamp,
//        address _dolomiteMargin
//    )
//    OnlyDolomiteMargin(
//        _dolomiteMargin
//    ) {
//        STAKING_TOKEN_MARKET_ID = _stakingTokenMarketId;
//        REWARD_TOKEN_MARKET_ID = _rewardTokenMarketId;
//        lastRewardUpdatedTimestamp = _startTimestamp;
//        Require.that(
//            _stakingTokenMarketId != _rewardTokenMarketId,
//            _FILE,
//            "Tokens cannot be the same"
//        );
//    }
//
//    // ==================================================
//    // ================ Owner Functions =================
//    // ==================================================
//
//    function ownerSetLastRewardUpdatedTimestamp(
//        uint32 _lastRewardUpdatedTimestamp
//    )
//    external
//    onlyDolomiteMarginOwner(msg.sender) {
//        lastRewardUpdatedTimestamp = _lastRewardUpdatedTimestamp;
//        emit LastRewardUpdatedTimestampSet(_lastRewardUpdatedTimestamp);
//    }
//
//    function ownerSetRewardTokenPerSecondWei(
//        uint256 _rewardTokenWeiPerSecond
//    )
//    external
//    onlyDolomiteMarginOwner(msg.sender) {
//        rewardTokenWeiPerSecond = _rewardTokenWeiPerSecond;
//        emit RewardTokenWeiPerSecondSet(_rewardTokenWeiPerSecond);
//    }
//
//    // ==================================================
//    // =============== External Functions ===============
//    // ==================================================
//
//    function deposit(
//        uint256 _fromAccountNumber,
//        uint256 _amount
//    ) external {
//        _deposit(msg.sender, _fromAccountNumber, _amount);
//    }
//
//    function withdraw(
//        uint256 _toAccountNumber,
//        uint256 _amount
//    ) external {
//        _withdraw(msg.sender, _toAccountNumber, _amount);
//    }
//
//    function harvest(uint256 _toAccountNumber) external {
//        _harvest(msg.sender, _toAccountNumber);
//    }
//
//    /**
//     * Withdraw without caring about rewards. EMERGENCY ONLY.
//     */
//    function emergencyWithdraw(uint256 _toAccountNumber) external {
//        UserInfo storage user = userInfo[msg.sender];
//        IDolomiteMargin.Par memory userBalancePar = user.balancePar;
//        if (userBalancePar.isZero() || userBalancePar.isLessThanZero()) {
//            // GUARD: If the user has no balance or it's somehow negative, do nothing
//            return;
//        }
//
//
//        user.balancePar = TypesLib.zeroPar();
//        user.rewardTokenRewardDebtPar = TypesLib.zeroPar();
//
//        if (totalSharesStakedPar.value >= userBalancePar.value) {
//            assert(totalSharesStakedPar.sign == userBalancePar.sign); // panic if the signs are different
//            totalSharesStakedPar = totalSharesStakedPar.sub(userBalancePar);
//        } else {
//            totalSharesStakedPar = TypesLib.zeroPar();
//        }
//
//        DOLOMITE_MARGIN.transfer(
//            /* _fromAccountOwner = */ address(this),
//            /* _fromAccountNumber = */ 0,
//            /* _toAccountOwner = */ msg.sender,
//            _toAccountNumber,
//            STAKING_TOKEN_MARKET_ID,
//            IDolomiteMargin.AssetDenomination.Par,
//            userBalancePar.value,
//            AccountBalanceLib.BalanceCheckFlag.From
//        );
//        emit EmergencyWithdraw(
//            msg.sender,
//            _toAccountNumber,
//            DOLOMITE_MARGIN.parToWei(STAKING_TOKEN_MARKET_ID, userBalancePar)
//        );
//    }
//
//    /** OPERATOR */
//    function depositFor(
//        address _fromAccountOwner,
//        uint256 _fromAccountNumber,
//        uint256 _amountWei
//    ) external {
//        // TODO fix operator?
//        if (msg.sender != operator) revert UNAUTHORIZED();
//        _deposit(_fromAccountOwner, _amountWei);
//    }
//
//    function withdrawFor(
//        address _toAccountOwner,
//        uint256 _toAccountNumber,
//        uint256 _amountWei
//    ) external {
//        // TODO fix operator?
//        if (msg.sender != operator) revert UNAUTHORIZED();
//        _withdraw(_toAccountOwner, _toAccountNumber, _amount);
//    }
//
//    function harvestFor(
//        address _toAccountOwner,
//        uint256 _toAccountNumber
//    ) external {
//        // TODO fix operator?
//        if (msg.sender != operator) revert UNAUTHORIZED();
//        _harvest(_toAccountOwner, _toAccountNumber);
//    }
//
//    // ==================================================
//    // ================ Public Functions ================
//    // ==================================================
//
//    /**
//     * Keep reward variables up to date. Ran before every mutative function.
//     */
//    function updateShares() public whenNotPaused {
//        if (block.timestamp <= lastRewardUpdatedTimestamp) {
//            // The shares have already been updated this block
//            return;
//        }
//
//        if (totalSharesStakedPar.isZero()) {
//            // if pool has no supply
//            lastRewardUpdatedTimestamp = uint32(block.timestamp);
//            return;
//        }
//
//        unchecked {
//            accumulatedRewardTokenPerSharePar += rewardPerSharePar(rewardTokenPerSecondWei);
//        }
//
//        lastRewardUpdatedTimestamp = uint32(block.timestamp);
//    }
//
//    /**
//     * Calculates the reward per share since `lastRewardSecond` was updated
//     */
//    function rewardPerSharePar(uint256 _rewardRatePerSecond) public view returns (uint128) {
//        // duration = block.timestamp - lastRewardSecond;
//        // tokenReward = duration * _rewardRatePerSecond;
//        // tokenRewardPerShare = (tokenReward * MUL_CONSTANT) / totalShares;
//
//        IDolomiteMargin.Wei memory totalSharesStakedWei = totalSharesStakedPar;
//        unchecked {
//            uint256 duration = block.timestamp - lastRewardUpdatedTimestamp;
//            return uint128((duration * _rewardRatePerSecond * MUL_CONSTANT) / totalSharesStakedPar);
//        }
//    }
//
//    function pendingRewardsWei(address _user) public view returns (uint256 _pendingRewardToken) {
//        uint256 tempAccumulatedRewardTokenPerShare = accumulatedRewardTokenPerSharePar;
//
//        if (block.timestamp > lastRewardUpdatedTimestamp && totalSharesStakedPar != 0) {
//            tempAccumulatedRewardTokenPerShare += rewardPerShare(rewardTokenWeiPerSecond);
//        }
//
//        UserInfo memory user = userInfo[_user];
//
//        _pendingRewardToken = _calculatePending(
//            user.rewardTokenRewardDebtPar,
//            tempAccumulatedRewardTokenPerShare,
//            user.balancePar
//        );
//    }
//
//    function _deposit(address _user, uint256 _amount) internal {
//        UserInfo storage user = userInfo[_user];
//        if (_amount == 0) revert DEPOSIT_ERROR();
//        updateShares();
//
//        uint256 _previousBalance = STAKING_TOKEN.balanceOf(address(this));
//
//        unchecked {
//            user.balancePar += _amount;
//            totalSharesStakedPar += _amount;
//        }
//
//        user.rewardTokenRewardDebtPar = user.rewardTokenRewardDebtPar + int128(uint128(_calculateRewardDebt(accumulatedRewardTokenPerSharePar, _amount)));
//
//        STAKING_TOKEN.transferFrom(_user, address(this), _amount);
//
//        unchecked {
//            if (_previousBalance + _amount != STAKING_TOKEN.balanceOf(address(this))) revert DEPOSIT_ERROR();
//        }
//
//        emit Deposit(_user, _amount);
//    }
//
//    function _withdraw(address _user, uint256 _amount) internal {
//        UserInfo storage user = userInfo[_user];
//        if (user.balancePar < _amount || _amount == 0) revert WITHDRAW_ERROR();
//        updateShares();
//
//        unchecked {
//            user.balancePar -= _amount;
//            totalSharesStakedPar -= _amount;
//        }
//
//        user.rewardTokenRewardDebtPar = user.rewardTokenRewardDebtPar - int128(uint128(_calculateRewardDebt(accumulatedRewardTokenPerSharePar, _amount)));
//
//        STAKING_TOKEN.transfer(_user, _amount);
//        emit Withdraw(_user, _amount);
//    }
//
//    function _harvest(address _toAccountOwner, uint256 _toAccountNumber) internal {
//        updateShares();
//        UserInfo storage user = userInfo[_toAccountOwner];
//
//        uint256 rewardTokenPending = _calculatePending(user.rewardTokenRewardDebtPar, accumulatedRewardTokenPerSharePar, user.balancePar);
//
//        user.rewardTokenRewardDebtPar = int128(uint128(_calculateRewardDebt(accumulatedRewardTokenPerSharePar, user.balancePar)));
//
//        IDolomiteMargin.Wei memory rewardMarketBalanceWei = DOLOMITE_MARGIN.getAccountWei(
//            IDolomiteMargin.AccountInfo({
//                owner: address(this),
//                number: 0
//            }),
//            REWARD_TOKEN_MARKET_ID
//        );
//        if (rewardTokenPending > rewardMarketBalanceWei.value) {
//            // scale down the user's rewards to the balance
//            rewardTokenPending = rewardMarketBalanceWei.value;
//        }
//        DOLOMITE_MARGIN.transfer(
//            /* _fromAccountOwner = */ address(this),
//            /* _fromAccountNumber = */ 0,
//            _toAccountOwner,
//            _toAccountNumber,
//            REWARD_TOKEN_MARKET_ID,
//            IDolomiteMargin.AssetDenomination.Wei,
//            rewardTokenPending,
//            AccountBalanceLib.BalanceCheckFlag.From
//        );
//
//        emit Harvest(_toAccountOwner, _toAccountNumber, rewardTokenPending);
//    }
//
//    function _calculatePending(
//        int128 _rewardDebt,
//        uint256 _accumulatedRewardTokenPerShare,
//        uint256 _amount
//    ) internal pure returns (uint128) {
//        if (_rewardDebt < 0) {
//            return uint128(_calculateRewardDebt(_accumulatedRewardTokenPerShare, _amount)) + uint128(-_rewardDebt);
//        } else {
//            return uint128(_calculateRewardDebt(_accumulatedRewardTokenPerShare, _amount)) - uint128(_rewardDebt);
//        }
//    }
//
//    function _calculateRewardDebt(
//        uint256 _accumulatedRewardTokenPerShare,
//        uint256 _amount
//    ) internal pure returns (uint256) {
//        unchecked {
//            return (_amount * _accumulatedRewardTokenPerShare) / MUL_CONSTANT;
//        }
//    }
//}
