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

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IEmitter } from "../interfaces/liquidityMining/IEmitter.sol";
import { IVester } from "../interfaces/liquidityMining/IVester.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IoARB } from "../interfaces/liquidityMining/IoARB.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";

import "hardhat/console.sol";

/**
 * @title   Vester
 * @author  Dolomite
 *
 * An implementation of the IEmitter interface that grants users oARB rewards for staking assets
 */
contract Vester is OnlyDolomiteMargin, IVester {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "Vester";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _WETH_MARKET_ID = 0;
    uint256 private constant _ARB_MARKET_ID = 7;
    uint256 private constant _DISCOUNT_BASE = 1_000;

    // ===================================================
    // ==================== State Variables ====================
    // ===================================================

    IDolomiteRegistry public immutable dolomiteRegistry;
    uint256 private nextId;
    mapping(uint256 => VestingPosition) public vestingPositions;
    uint256 public oARBMarketId;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        uint256 _oARBMarketId
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        dolomiteRegistry = IDolomiteRegistry(_dolomiteRegistry);
        oARBMarketId = _oARBMarketId;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function vest(uint256 _fromAccountNumber, uint256 _duration, uint256 _amount) external returns (uint256) {
        // Validation duration
        if (_duration >= 1 weeks && _duration <= 4 weeks && _duration % 1 weeks == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_duration >= 1 weeks && _duration <= 4 weeks && _duration % 1 weeks == 0,
            _FILE,
            "Invalid duration"
        );

        // Create vesting position NFT or mapping
        nextId++;
        vestingPositions[nextId] = VestingPosition(
            msg.sender,
            nextId,
            block.timestamp,
            _duration,
            _amount
        );

        // Transfer amounts in to hash of id and msg.sender
        _transfer(
            msg.sender,
            _fromAccountNumber,
            address(this),
            uint256(keccak256(abi.encodePacked(msg.sender, nextId))),
            oARBMarketId,
            _amount
        );
        _transfer(
            msg.sender,
            _fromAccountNumber,
            address(this),
            uint256(keccak256(abi.encodePacked(msg.sender, nextId))),
            _ARB_MARKET_ID,
            _amount
        );

        return nextId;
    }

    // @follow-up Some mechanism to force close after a week
    function closePositionAndBuyTokens(uint256 _id) external payable {
        VestingPosition memory _position = vestingPositions[_id];
        if (_position.owner == msg.sender) { /* FOR COVERAGE TESTING */ }
        Require.that(_position.owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        if (block.timestamp > _position.startTime + _position.duration) { /* FOR COVERAGE TESTING */ }
        Require.that(block.timestamp > _position.startTime + _position.duration,
            _FILE,
            "Position not vested"
        );
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(msg.sender, _id)));

        // Burn oARB tokens
        IoARB oARB = IoARB(DOLOMITE_MARGIN().getMarketTokenAddress(oARBMarketId));
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            address(this),
            accountNumber,
            address(this),
            oARBMarketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _position.amount
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );
        oARB.burn(_position.amount);

        // Deposit ARB tokens back into dolomite
        _transfer(
            address(this),
            accountNumber,
            msg.sender,
            _DEFAULT_ACCOUNT_NUMBER,
            _ARB_MARKET_ID,
            _position.amount
        );

        // Calculate price
        uint256 discount = _calculateDiscount(_position.duration);
        uint256 wethPrice = (DOLOMITE_MARGIN().getMarketPrice(0)).value;

        uint256 arbValue = _position.amount * ((DOLOMITE_MARGIN().getMarketPrice(_ARB_MARKET_ID)).value) * discount / _DISCOUNT_BASE;
        uint256 wethValue = msg.value * wethPrice;
        if (wethValue >= arbValue) { /* FOR COVERAGE TESTING */ }
        Require.that(wethValue >= arbValue,
            _FILE,
            "Insufficient msg.value"
        );

        // Deposit purchased ARB tokens into dolomite and clear position
        _depositARBIntoDolomite(msg.sender, _position.amount);
        delete vestingPositions[_id];

        // Send refund
        uint256 refund = (wethValue - arbValue) / wethPrice;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            if (success) { /* FOR COVERAGE TESTING */ }
            Require.that(success,
                _FILE,
                "Refund failed"
            );
        }
    }

    // @follow-up Do we want this function? Maybe send ARB back but burn oARB instead?
    // WARNING: This will forfeit all vesting progress
    function emergencyWithdraw(uint256 _id) external {
        VestingPosition memory _position = vestingPositions[_id];
        if (_position.owner == msg.sender) { /* FOR COVERAGE TESTING */ }
        Require.that(_position.owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(msg.sender, _id)));

        // Transfer arb and oARB and ARB back to the user
        _transfer(
            address(this),
            accountNumber,
            msg.sender,
            _DEFAULT_ACCOUNT_NUMBER,
            oARBMarketId,
            _position.amount
        );
        _transfer(
            address(this),
            accountNumber,
            msg.sender,
            _DEFAULT_ACCOUNT_NUMBER,
            _ARB_MARKET_ID,
            _position.amount
        );

        delete vestingPositions[_id];
    }

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

    function _depositARBIntoDolomite(
        address _account,
        uint256 _amount
    ) internal {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IERC20 arb = IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(_ARB_MARKET_ID));
        arb.safeApprove(address(dolomiteMargin), _amount);
        AccountActionLib.deposit(
            dolomiteMargin,
            _account,
            address(this),
            _DEFAULT_ACCOUNT_NUMBER,
            _ARB_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            })
        );
    }

    function _calculateDiscount(uint256 _duration) internal pure returns (uint256) {
        if (_duration == 1 weeks) {
            return 975;
        }
        else if (_duration == 2 weeks) {
            return 950;
        }
        else if (_duration == 3 weeks) {
            return 900;
        }
        else if (_duration == 4 weeks) {
            return 800;
        }
        else {
            // @follow-up Do we want this extra check or no need?
            revert();
        }
    }
}
