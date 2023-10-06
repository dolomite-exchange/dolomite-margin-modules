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

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IEmitter } from "../interfaces/liquidityMining/IEmitter.sol";
import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { IVester } from "../interfaces/liquidityMining/IVester.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   Vester
 * @author  Dolomite
 *
 * An implementation of the IEmitter interface that grants users oARB rewards for staking assets
 */
contract Vester is OnlyDolomiteMargin, ReentrancyGuard, IVester {
    using SafeERC20 for IERC20;
    using SafeERC20 for IOARB;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "Vester";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _DISCOUNT_BASE = 1_000;

    uint256 private constant _MIN_DURATION = 1 weeks;
    uint256 private constant _MAX_DURATION = 4 weeks;
    uint256 private constant _DURATION_INTERVAL = 1 weeks;

    // ===================================================
    // ==================== State Variables ====================
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line
    uint256 public immutable WETH_MARKET_ID; // solhint-disable-line
    uint256 public immutable ARB_MARKET_ID; // solhint-disable-line

    uint256 private _nextId;

    mapping(uint256 => VestingPosition) public vestingPositions;
    uint256 public promisedArbTokens;
    bool public vestingActive;
    IOARB public oARB;

    // ==================================================================
    // ======================= Modifiers =======================
    // ==================================================================

    modifier requireVestingActive() {
        Require.that(
            vestingActive,
            _FILE,
            "Vesting not active"
        );
        _;
    }

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        uint256 _wethMarketId,
        uint256 _arbMarketId,
        IOARB _oARB
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        WETH_MARKET_ID = _wethMarketId;
        ARB_MARKET_ID = _arbMarketId;
        oARB = _oARB;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function vest(
        uint256 _fromAccountNumber,
        uint256 _duration,
        uint256 _amount
    ) 
    external 
    requireVestingActive 
    returns (uint256) {
        IERC20 arb = IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(ARB_MARKET_ID));
        Require.that(
            arb.balanceOf(address(this)) >= _amount + promisedArbTokens,
            _FILE,
            "Vesting not available" // @follow-up this message
        );
        Require.that(
            _duration >= _MIN_DURATION && _duration <= _MAX_DURATION && _duration % _DURATION_INTERVAL == 0,
            _FILE,
            "Invalid duration"
        );

        // Create vesting position NFT or mapping
        uint256 vestingId = ++_nextId;
        vestingPositions[vestingId] = VestingPosition({
            owner: msg.sender,
            id: _nextId,
            startTime: block.timestamp,
            duration: _duration,
            amount: _amount
        });

        // Transfer amounts in to hash of id and msg.sender
        oARB.safeTransferFrom(msg.sender, address(this), _amount);
        _transfer(
            /* fromAccount = */ msg.sender,
            /* fromAccountNumber = */ _fromAccountNumber,
            /* toAccount = */ address(this),
            /* toAccountNumber = */ uint256(keccak256(abi.encodePacked(msg.sender, vestingId))),
            /* marketId */ ARB_MARKET_ID,
            /* amount */ _amount
        );

        promisedArbTokens += _amount;
        emit Vesting(msg.sender, _duration, _amount, vestingId);
        return vestingId;
    }

    // @follow-up This is kind of a long function. When do you decide to break it up?
    function closePositionAndBuyTokens(
        uint256 _id
    ) 
    external 
    nonReentrant 
    payable {
        VestingPosition memory _position = vestingPositions[_id];
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(msg.sender, _id)));
        Require.that(
            _position.owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        Require.that(
            block.timestamp > _position.startTime + _position.duration,
            _FILE,
            "Position not vested"
        );
        Require.that(
            block.timestamp <= _position.startTime + _position.duration + _DURATION_INTERVAL,
            _FILE,
            "Position expired"
        );

        // Burn oARB and deposit ARB tokens back into dolomite
        oARB.burn(_position.amount);
        _transfer(
            /* fromAccount = */ address(this),
            /* fromAccountNumber = */ accountNumber,
            /* toAccount = */ msg.sender,
            /* toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* marketId */ ARB_MARKET_ID,
            /* amount */ _position.amount
        );

        // Calculate price
        uint256 discount = _calculateDiscount(_position.duration);
        uint256 wethPrice = (DOLOMITE_MARGIN().getMarketPrice(WETH_MARKET_ID)).value;
        uint256 arbPriceAdj = ((DOLOMITE_MARGIN().getMarketPrice(ARB_MARKET_ID)).value) * discount / _DISCOUNT_BASE;

        uint256 wethValue = msg.value * wethPrice;
        uint256 arbValue = _position.amount * arbPriceAdj;
        Require.that(
            wethValue >= arbValue,
            _FILE,
            "Insufficient msg.value"
        );

        // Deposit purchased ARB tokens into dolomite, clear vesting position, and refund
        _depositARBIntoDolomite(msg.sender, _position.amount);
        promisedArbTokens -= _position.amount;
        delete vestingPositions[_id];
        
        uint256 refund = (wethValue - arbValue) / wethPrice;
        if (refund > 0) {
            Address.sendValue(payable(msg.sender), refund);
        }

        emit PositionClosed(msg.sender, _id);
    }

    // @follow-up Who should this be callable by? Operator?
    function forceClosePosition(
        uint256 _id
    ) 
    external 
    onlyDolomiteMarginGlobalOperator(msg.sender) {
        VestingPosition memory _position = vestingPositions[_id];
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(_position.owner, _id)));
        Require.that(
            block.timestamp > _position.startTime + _position.duration + 1 weeks,
            _FILE,
            "Position not expired"
        );

        // @follow-up Burn oARB or transfer them back to user
        // Burn oARB and deposit ARB tokens back into dolomite
        oARB.burn(_position.amount);
        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ _position.owner,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ _position.amount
        );

        promisedArbTokens -= _position.amount;
        emit PositionClosed(_position.owner, _id);
        delete vestingPositions[_id];
    }

    // @follow-up Do we want this function? Maybe send ARB back but burn oARB instead?
    // WARNING: This will forfeit all vesting progress
    function emergencyWithdraw(uint256 _id) external {
        VestingPosition memory _position = vestingPositions[_id];
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(msg.sender, _id)));
        Require.that(
            _position.owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );

        // Transfer arb and oARB back to the user
        oARB.safeTransfer(msg.sender, _position.amount);
        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ msg.sender,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ _position.amount
        );

        promisedArbTokens -= _position.amount;
        delete vestingPositions[_id];
        emit EmergencyWithdraw(msg.sender, _id);
    }

    // ==================================================================
    // ======================= Admin Functions ==========================
    // ==================================================================

    function ownerSetVestingActive(
        bool _vestingActive
    ) 
    external 
    onlyDolomiteMarginOwner(msg.sender) {
        vestingActive = _vestingActive;
        emit VestingActiveSet(_vestingActive);
    }

    function ownerSetOARB(
        address _oARB
    ) 
    external 
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            promisedArbTokens == 0,
            _FILE,
            "Outstanding vesting positions"
        );
        oARB = IOARB(_oARB);
        emit OARBSet(_oARB);
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

    function _depositARBIntoDolomite(
        address _account,
        uint256 _amount
    ) internal {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IERC20 arb = IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(ARB_MARKET_ID));
        arb.safeApprove(address(dolomiteMargin), _amount);
        AccountActionLib.deposit(
            dolomiteMargin,
            _account,
            address(this),
            _DEFAULT_ACCOUNT_NUMBER,
            ARB_MARKET_ID,
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
        } else if (_duration == 2 weeks) {
            return 950;
        } else if (_duration == 3 weeks) {
            return 900;
        } else {
            assert(_duration == 4 weeks);
            return 800;
        }
    }
}
