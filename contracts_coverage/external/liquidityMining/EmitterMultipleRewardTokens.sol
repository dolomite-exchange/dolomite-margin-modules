// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2023 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IEmitterMultipleRewardTokens } from "../interfaces/liquidityMining/IEmitterMultipleRewardTokens.sol";
import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { IStorageVault } from "../interfaces/liquidityMining/IStorageVault.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   EmitterMultipleRewardTokens
 * @author  Dolomite
 *
 * An implementation of the IEmitterMultipleREwardTokens interface
 * that grants users oARB rewards for staking assets
 */
contract EmitterMultipleRewardTokens is OnlyDolomiteMargin, IEmitterMultipleRewardTokens {
    using SafeERC20 for IOARB;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using TypesLib for IDolomiteStructs.Par;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "Emitter";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _SCALE = 1e18;

    // ===================================================
    // ==================== State Variables ====================
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line

    EnumerableSet.UintSet private _pools;
    EnumerableSet.AddressSet private _rewardTokens;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(uint256 => PoolInfo) public poolInfo;
    mapping(address => RewardToken) public rewardTokenInfo;

    uint256 public rewardTokenPerSecond;
    uint256 public totalAllocPoint;
    uint256 public startTime;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        uint256 _rewardTokenPerSecond,
        uint256 _startTime
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        rewardTokenPerSecond = _rewardTokenPerSecond;
        startTime = _startTime;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function deposit(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    ) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({
             owner: address(this),
             number: uint256(uint160(msg.sender))
        });

        if (_pools.contains(_marketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pools.contains(_marketId),
            _FILE,
            "Pool not initialized"
        );
        if (_amountWei > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_amountWei > 0,
            _FILE,
            "Invalid amount"
        );

        // Transfer _amountWei to this contract
        IDolomiteStructs.Par memory beforeAccountPar = DOLOMITE_MARGIN().getAccountPar(info, _marketId);
        _transfer(
            /* _fromAccount = */ msg.sender,
            /* _fromAccountNumber = */ _fromAccountNumber,
            /* _toAccount = */ address(this),
            /* _toAccountNumber = */ uint256(uint160(msg.sender)),
            /* _marketId = */ _marketId,
            /* _amountWei */ _amountWei
        );
        IDolomiteStructs.Par memory changeAccountPar =
            DOLOMITE_MARGIN().getAccountPar(info, _marketId).sub(beforeAccountPar);
        /*assert(changeAccountPar.sign);*/

        uint256 cachedAmount = user.amount;
        updatePool(_marketId);
        pool.totalPar += changeAccountPar.value;
        user.amount += changeAccountPar.value;

        uint256 len = _rewardTokens.length();
        if (cachedAmount > 0) {
            for (uint256 i; i < len; i++) {
                RewardToken memory rewardToken = rewardTokenInfo[_rewardTokens.at(i)];
                uint256 pending =
                    (cachedAmount * pool.accRewardTokenPerShares[rewardToken.token] / _SCALE)
                        - user.rewardDebts[rewardToken.token];
                user.rewardDebts[rewardToken.token] =
                    user.amount * pool.accRewardTokenPerShares[rewardToken.token] / _SCALE;

                IStorageVault(rewardToken.tokenStorageVault).pullTokensFromVault(pending);
                IERC20(rewardToken.token).transfer(msg.sender, pending);
            }
        }

        emit Deposit(msg.sender, _marketId, _amountWei);
    }

    function withdraw(
        uint256 _marketId,
        uint256 _amountWei
    ) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: uint256(uint160(msg.sender))
        });

        if (_pools.contains(_marketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pools.contains(_marketId),
            _FILE,
            "Pool not initialized"
        );

        uint256 withdrawalAmount;
        if (_amountWei == type(uint256).max) {
            withdrawalAmount = (DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value;
        }
        else {
            if ((DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value >= _amountWei) { /* FOR COVERAGE TESTING */ }
            Require.that((DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value >= _amountWei,
                _FILE,
                "Insufficient balance"
            );
            withdrawalAmount = _amountWei;
        }

        // We calculate the change in par value based on the transfer of the wei amount
        updatePool(_marketId);

        uint256 cachedAmount = user.amount;
        if(withdrawalAmount > 0) {
            IDolomiteStructs.Par memory beforeAccountPar = DOLOMITE_MARGIN().getAccountPar(info, _marketId);
            _transfer(
                /* _fromAccount = */ address(this),
                /* _fromAccountNumber = */ uint256(uint160(msg.sender)),
                /* _toAccount = */ msg.sender,
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                /* _marketId = */ _marketId,
                /* _amountWei */ withdrawalAmount
            );
            IDolomiteStructs.Par memory changeAccountPar =
                beforeAccountPar.sub(DOLOMITE_MARGIN().getAccountPar(info, _marketId));
            /*assert(changeAccountPar.sign);*/

            user.amount = user.amount - changeAccountPar.value;
            pool.totalPar -= changeAccountPar.value;
        }

        uint256 len = _rewardTokens.length();
        if (cachedAmount > 0) {
            for (uint256 i; i < len; i++) {
                RewardToken memory rewardToken = rewardTokenInfo[_rewardTokens.at(i)];
                uint256 pending =
                    (cachedAmount * pool.accRewardTokenPerShares[rewardToken.token] / _SCALE)
                        - user.rewardDebts[rewardToken.token];
                user.rewardDebts[rewardToken.token] =
                    user.amount * pool.accRewardTokenPerShares[rewardToken.token] / _SCALE;

                IStorageVault(rewardToken.tokenStorageVault).pullTokensFromVault(pending);
                IERC20(rewardToken.token).transfer(msg.sender, pending);
            }
        }

        emit Withdraw(msg.sender, _marketId, withdrawalAmount);
    }

    function emergencyWithdraw(uint256 _marketId) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: uint256(uint160(msg.sender))
        });

        uint256 amountWei = (DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value;
        if (amountWei > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(amountWei > 0,
            _FILE,
            "Insufficient balance"
        );

        user.amount = 0;
        uint256 len = _rewardTokens.length();
        for (uint256 i; i < len; i++) {
            RewardToken memory rewardToken = rewardTokenInfo[_rewardTokens.at(i)];
            user.rewardDebts[rewardToken.token] = 0;
        }

        // @follow-up Which account number to transfer to?
        IDolomiteStructs.Par memory beforeAccountPar = DOLOMITE_MARGIN().getAccountPar(info, _marketId);
        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ uint256(uint160(msg.sender)),
            /* _toAccount = */ msg.sender,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ _marketId,
            /* _amountWei */ amountWei
        );
        IDolomiteStructs.Par memory changeAccountPar =
            beforeAccountPar.sub(DOLOMITE_MARGIN().getAccountPar(info, _marketId));
        /*assert(changeAccountPar.sign);*/

        pool.totalPar -= changeAccountPar.value;
        emit EmergencyWithdraw(msg.sender, _marketId, amountWei);
    }

    function massUpdatePools() public {
        uint256 len = _pools.length();
        for (uint256 i; i < len; i++) {
            updatePool(_pools.at(i));
        }
    }

    function updatePool(uint256 _marketId) public {
        PoolInfo storage pool = poolInfo[_marketId];
        uint256 supply = pool.totalPar;

        uint256 len = _rewardTokens.length();
        for (uint256 i; i < len; i++) {
            RewardToken memory rewardToken = rewardTokenInfo[_rewardTokens.at(i)];

            if (block.timestamp <= pool.lastRewardTimes[rewardToken.token]) {
                return;
            }

            if(supply == 0) {
                pool.lastRewardTimes[rewardToken.token] = block.timestamp;
                return;
            }

            if (rewardToken.isAccruing) {
                uint256 reward =
                    rewardTokenPerSecond * pool.allocPoint * (block.timestamp - pool.lastRewardTimes[rewardToken.token])
                        / totalAllocPoint;
                pool.accRewardTokenPerShares[rewardToken.token]
                    = pool.accRewardTokenPerShares[rewardToken.token] + (reward * _SCALE / supply);
                pool.lastRewardTimes[rewardToken.token] = block.timestamp;
            }
        }
    }

    function userRewardDebt( // solhint-disable-line ordering
        uint256 _marketId,
        address _user,
        address _rewardToken
    )
    external
    view
    returns (uint256) {
        return userInfo[_marketId][_user].rewardDebts[_rewardToken];
    }

    function poolLastRewardTime(uint256 _marketId, address _rewardToken)
    external
    view
    returns (uint256) {
        return poolInfo[_marketId].lastRewardTimes[_rewardToken];
    }

    function poolAccRewardTokenPerShares(uint256 _marketId, address _rewardToken)
    external
    view
    returns (uint256) {
        return poolInfo[_marketId].accRewardTokenPerShares[_rewardToken];
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerAddRewardToken(
        address _token,
        address _tokenStorageVault,
        bool _isAccruing
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (!_rewardTokens.contains(_token)) { /* FOR COVERAGE TESTING */ }
        Require.that(!_rewardTokens.contains(_token),
            _FILE,
            "Reward token already exists"
        );

        rewardTokenInfo[_token] = RewardToken({
            token: _token,
            tokenStorageVault: _tokenStorageVault,
            isAccruing: _isAccruing
        });
        _rewardTokens.add(_token);
        _updateLastRewardTimesForRewardToken(_token);
    }

    function ownerEnableRewardToken(
        address _token
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_rewardTokens.contains(_token)) { /* FOR COVERAGE TESTING */ }
        Require.that(_rewardTokens.contains(_token),
            _FILE,
            "Reward token does not exist"
        );

        RewardToken storage rewardToken = rewardTokenInfo[_token];
        rewardToken.isAccruing = true;
        _updateLastRewardTimesForRewardToken(_token);
    }

    function ownerDisableRewardToken(
        address _token
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_rewardTokens.contains(_token)) { /* FOR COVERAGE TESTING */ }
        Require.that(_rewardTokens.contains(_token),
            _FILE,
            "Reward token does not exist"
        );
        massUpdatePools();
        RewardToken storage rewardToken = rewardTokenInfo[_token];
        rewardToken.isAccruing = false;
    }

    // @follow-up I tested this functionality to remove and add back later, but should be fully investigated more
    function ownerRemoveRewardToken(
        address _token
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_rewardTokens.contains(_token)) { /* FOR COVERAGE TESTING */ }
        Require.that(_rewardTokens.contains(_token),
            _FILE,
            "Reward token does not exist"
        );
        delete rewardTokenInfo[_token];
        _rewardTokens.remove(_token);
    }

    function ownerAddPool(
        uint256 _marketId,
        uint256 _allocPoint,
        bool _withUpdate
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (!_pools.contains(_marketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(!_pools.contains(_marketId),
            _FILE,
            "Pool already exists"
        );
        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint + _allocPoint;

        PoolInfo storage pool = poolInfo[_marketId];
        pool.marketId = _marketId;
        pool.allocPoint = _allocPoint;

        uint256 len = _rewardTokens.length();
        for (uint256 i; i < len; i++) {
            RewardToken memory rewardToken = rewardTokenInfo[_rewardTokens.at(i)];
            pool.lastRewardTimes[rewardToken.token] = lastRewardTime;
        }
        _pools.add(_marketId);
    }

    function ownerSetPool(
        uint256 _marketId,
        uint256 _allocPoint
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_pools.contains(_marketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pools.contains(_marketId),
            _FILE,
            "Pool not initialized"
        );
        totalAllocPoint += _allocPoint - poolInfo[_marketId].allocPoint;
        poolInfo[_marketId].allocPoint = _allocPoint;
    }

    function ownerSetRewardTokenPerSecond(
        uint256 _rewardTokenPerSecond
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        massUpdatePools();
        rewardTokenPerSecond = _rewardTokenPerSecond;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _transfer(
        address _fromAccount,
        uint256 _fromAccountNumber,
        address _toAccount,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amount
    ) internal {
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            _fromAccount,
            _fromAccountNumber,
            _toAccount,
            _toAccountNumber,
            _marketId,
            IDolomiteStructs.AssetDenomination.Wei,
            _amount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function _updateLastRewardTimesForRewardToken(
        address _rewardToken
    ) internal {
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;

        uint256 len = _pools.length();
        for (uint256 i; i < len; i++) {
            PoolInfo storage pool = poolInfo[_pools.at(i)];
            pool.lastRewardTimes[_rewardToken] = lastRewardTime;
        }
    }
}
