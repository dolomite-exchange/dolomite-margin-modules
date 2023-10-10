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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IEmitter } from "../interfaces/liquidityMining/IEmitter.sol";
import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   Emitter
 * @author  Dolomite
 *
 * An implementation of the IEmitter interface that grants users oARB rewards for staking assets
 */
contract Emitter is OnlyDolomiteMargin, IEmitter {
    using SafeERC20 for IOARB;
    using EnumerableSet for EnumerableSet.UintSet;
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
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(uint256 => PoolInfo) public poolInfo;

    IOARB public oARB;
    uint256 public oARBPerSecond;
    uint256 public totalAllocPoint;
    uint256 public startTime;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        address _oARB,
        uint256 _oARBPerSecond,
        uint256 _startTime
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        oARB = IOARB(_oARB);
        oARBPerSecond = _oARBPerSecond;
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

        updatePool(_marketId);
        // Reset reward debt in the case of new campaign
        if (user.lastUpdateTime < startTime) {
            user.rewardDebt = 0;
        }

        if (user.amount > 0) {
            uint256 pending = user.amount * pool.accOARBPerShare / _SCALE - user.rewardDebt;
            oARB.mint(pending);
            oARB.transfer(msg.sender, pending);
        }

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

        pool.totalPar += changeAccountPar.value;
        user.amount += changeAccountPar.value;
        user.rewardDebt = user.amount * pool.accOARBPerShare / _SCALE;
        user.lastUpdateTime = block.timestamp;

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


        updatePool(_marketId);
        if (user.lastUpdateTime < startTime) {
            user.rewardDebt = 0;
        }

        uint256 pending = user.amount * pool.accOARBPerShare / _SCALE - user.rewardDebt;
        oARB.mint(pending);
        oARB.transfer(msg.sender, pending);

        // We calculate the change in par value based on the transfer of the wei amount
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

        user.rewardDebt = user.amount * pool.accOARBPerShare / _SCALE;
        user.lastUpdateTime = block.timestamp;
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
        user.rewardDebt = 0;
        user.lastUpdateTime = 0;

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
        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }

        uint256 supply = pool.totalPar;
        if (supply == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }

        uint256 reward = oARBPerSecond * pool.allocPoint * (block.timestamp - pool.lastRewardTime) / totalAllocPoint;
        pool.accOARBPerShare = pool.accOARBPerShare + reward * _SCALE / supply;
        pool.lastRewardTime = block.timestamp;
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerAddPool( // solhint-disable-line ordering
        uint256 _marketId,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyDolomiteMarginOwner(msg.sender) {
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
        poolInfo[_marketId] =
            PoolInfo({
                marketId: _marketId,
                allocPoint: _allocPoint,
                lastRewardTime: lastRewardTime,
                accOARBPerShare: 0,
                totalPar: 0
            });
        _pools.add(_marketId);
    }

    function ownerSetPool(
        uint256 _marketId,
        uint256 _allocPoint
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_pools.contains(_marketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pools.contains(_marketId),
            _FILE,
            "Pool not initialized"
        );
        totalAllocPoint += _allocPoint - poolInfo[_marketId].allocPoint;
        poolInfo[_marketId].allocPoint = _allocPoint;
    }

    function ownerCreateNewCampaign(
        uint256 _startTime,
        IOARB _oARB
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_startTime >= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(_startTime >= block.timestamp,
            _FILE,
            "Invalid startTime"
        );
        startTime = _startTime;
        oARB = _oARB;

        uint256 len = _pools.length();
        for (uint256 i; i < len; i++) {
            poolInfo[_pools.at(i)].lastRewardTime = startTime;
            poolInfo[_pools.at(i)].accOARBPerShare = 0;
        }
    }

    function ownerSetOARBPerSecond(
        uint256 _oARBPerSecond
    ) external onlyDolomiteMarginOwner(msg.sender) {
        massUpdatePools();
        oARBPerSecond = _oARBPerSecond;
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
}
