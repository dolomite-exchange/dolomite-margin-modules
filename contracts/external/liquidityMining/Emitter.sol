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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
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
    using SafeERC20 for IERC20;
    using SafeERC20 for IOARB;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "Emitter";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    // ===================================================
    // ==================== State Variables ====================
    // ===================================================

    // @follow-up What to make immutable?
    IDolomiteRegistry public immutable dolomiteRegistry;
    IOARB public immutable oARB;

    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(uint256 => PoolInfo) public poolInfo;

    // @follow-up What to make updateable?
    uint256 public oARBPerBlock; 
    uint256 public totalAllocPoint;
    uint256 public startBlock;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        address _oARB,
        uint256 _oARBPerBlock,
        uint256 _startBlock
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        dolomiteRegistry = IDolomiteRegistry(_dolomiteRegistry);
        oARB = IOARB(_oARB);
        oARBPerBlock = _oARBPerBlock;
        startBlock = _startBlock;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function deposit(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amount
    ) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({
             owner: address(this),
             number: uint256(uint160(msg.sender))
        });

        Require.that(
            pool.marketId != 0,
            _FILE,
            "Pool not initialized"
        );
        Require.that(
            _amount > 0,
            _FILE,
            "Invalid amount"
        );

        updatePool(_marketId);
        if (user.amount > 0) {
            uint256 pending = user.amount * pool.accOARBPerShare / 1e18 - user.rewardDebt;
            oARB.mint(pending);
            _depositOARBIntoDolomite(msg.sender, pending);
        }

        // We calculate the change in par value based on the transfer of the wei amount
        // @audit Check to make sure we are ok ignoring sign of par values
        uint256 beforeAccountPar = (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value;
        _transfer(msg.sender, _fromAccountNumber, address(this), uint256(uint160(msg.sender)), _marketId, _amount);
        uint256 changeAccountPar = (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value - beforeAccountPar;

        pool.totalPar += changeAccountPar;
        user.amount += changeAccountPar;
        user.rewardDebt = user.amount * pool.accOARBPerShare / 1e18;

        emit Deposit(msg.sender, _marketId, _amount);
    }

    function withdraw(
        uint256 _marketId,
        uint256 _amount
    ) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({ 
            owner: address(this),
            number: uint256(uint160(msg.sender))
        });

        Require.that(
            pool.marketId != 0,
            _FILE,
            "Pool not initialized"
        );

        uint256 withdrawalAmount;
        if (_amount == type(uint256).max) {
            withdrawalAmount = (DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value;
        }
        else {
            Require.that(
                (DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value >= _amount,
                _FILE,
                "Insufficient balance"
            );
            withdrawalAmount = _amount;
        }


        updatePool(_marketId);
        uint256 pending = user.amount * pool.accOARBPerShare / 1e18 - user.rewardDebt;
        oARB.mint(pending);
        _depositOARBIntoDolomite(msg.sender, pending);

        // We calculate the change in par value based on the transfer of the wei amount
        if(withdrawalAmount > 0) {
            uint256 beforeAccountPar = (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value;
            _transfer(
                address(this),
                uint256(uint160(msg.sender)),
                msg.sender,
                _DEFAULT_ACCOUNT_NUMBER,
                _marketId,
                withdrawalAmount
            );
            uint256 changeAccountPar = beforeAccountPar - (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value;

            user.amount = user.amount - changeAccountPar;
            pool.totalPar -= changeAccountPar;
        }

        user.rewardDebt = user.amount * pool.accOARBPerShare / 1e18;
        emit Withdraw(msg.sender, _marketId, withdrawalAmount);
    }

    function emergencyWithdraw(uint256 _marketId) external {
        PoolInfo storage pool = poolInfo[_marketId];
        UserInfo storage user = userInfo[_marketId][msg.sender];
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({ 
            owner: address(this),
            number: uint256(uint160(msg.sender))
        });

        uint256 amount = (DOLOMITE_MARGIN().getAccountWei(info, _marketId)).value;
        Require.that(
            amount > 0,
            _FILE,
            "Insufficient balance"
        );
        user.amount = 0;
        user.rewardDebt = 0;

        // @follow-up Which account number to transfer to?
        uint256 beforeAccountPar = (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value;
        _transfer(address(this), uint256(uint160(msg.sender)), msg.sender, _DEFAULT_ACCOUNT_NUMBER, _marketId, amount);
        uint256 changeAccountPar = beforeAccountPar - (DOLOMITE_MARGIN().getAccountPar(info, _marketId)).value;
        pool.totalPar -= changeAccountPar;

        emit EmergencyWithdraw(msg.sender, _marketId, amount);
    }

    function updatePool(uint256 _marketId) public {
        // @follow-up Where can we switch these to memory throughout the code
        PoolInfo storage pool = poolInfo[_marketId];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 supply = pool.totalPar;
        if (supply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 reward = oARBPerBlock * pool.allocPoint * (block.number - pool.lastRewardBlock) / totalAllocPoint;
        pool.accOARBPerShare = pool.accOARBPerShare + reward * 1e18 / supply;
        pool.lastRewardBlock = block.number;
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    // @follow-up Do we want update flag with mass update pools function?
    // MasterChef has it but it didn't feel super necessary
    function add( // solhint-disable-line ordering
        uint256 _marketId,
        uint256 _allocPoint
    ) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo[_marketId] = 
            PoolInfo({
                marketId: _marketId,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accOARBPerShare: 0,
                totalPar: 0
            });
    }

    function set(
        uint256 _marketId,
        uint256 _allocPoint
    ) public onlyDolomiteMarginOwner(msg.sender) {
        totalAllocPoint += _allocPoint - poolInfo[_marketId].allocPoint;
        poolInfo[_marketId].allocPoint = _allocPoint;
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
            AccountBalanceLib.BalanceCheckFlag.From
        );
    }

    function _depositOARBIntoDolomite(
        address _account,
        uint256 _amount
    ) internal {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        oARB.safeApprove(address(dolomiteMargin), _amount);
        AccountActionLib.deposit(
            dolomiteMargin,
            _account,
            address(this),
            _DEFAULT_ACCOUNT_NUMBER,
            oARB.marketId(),
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            })
        );
    }
}
