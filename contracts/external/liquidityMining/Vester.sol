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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { IVester } from "../interfaces/liquidityMining/IVester.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   Vester
 * @author  Dolomite
 *
 * An implementation of the IVester interface that allows users to buy ARB at a discount if they vest ARB and oARB for a
 * certain amount of time
 */
contract Vester is
    ProxyContractHelpers,
    OnlyDolomiteMargin,
    ReentrancyGuard,
    ERC721Enumerable,
    Initializable,
    IVester
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IOARB;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "Vester";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _BASE = 10_000;

    uint256 private constant _MIN_DURATION = 1 weeks;
    uint256 private constant _MAX_DURATION = 4 weeks;

    bytes32 private constant _NEXT_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.nextId")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _VESTING_POSITIONS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vestingPositions")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PROMISED_ARB_TOKENS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.promisedArbTokens")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _OARB_SLOT = bytes32(uint256(keccak256("eip1967.proxy.oarb")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _CLOSE_POSITION_WINDOW_SLOT = bytes32(uint256(keccak256("eip1967.proxy.closePositionWindow")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _FORCE_CLOSE_POSITION_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.forceClosePositionTax")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _EMERGENCY_WITHDRAW_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.emergencyWithdrawTax")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_VESTING_ACTIVE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isVestingActive")) - 1); // solhint-disable-line max-line-length

    // =========================================================
    // ==================== State Variables ====================
    // =========================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line
    IWETH public immutable WETH; // solhint-disable-line
    uint256 public immutable WETH_MARKET_ID; // solhint-disable-line
    IERC20 public immutable ARB; // solhint-disable-line
    uint256 public immutable ARB_MARKET_ID; // solhint-disable-line

    // =========================================================
    // ======================= Modifiers =======================
    // =========================================================

    modifier requireVestingActive() {
        Require.that(
            isVestingActive(),
            _FILE,
            "Vesting not active"
        );
        _;
    }

    // ===========================================================
    // ======================= Initializer =======================
    // ===========================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        IWETH _weth,
        IERC20 _arb
    ) OnlyDolomiteMargin(_dolomiteMargin) ERC721("Dolomite oARB Vesting", "voARB") {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        WETH = _weth;
        WETH_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_weth));
        ARB = _arb;
        ARB_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_arb));
    }

    function initialize(
        address _oARB
    ) external initializer {
        _ownerSetIsVestingActive(true);
        _ownerSetOARB(_oARB);
        _ownerSetClosePositionWindow(1 weeks);
        _ownerSetForceClosePositionTax(500); // 5%
        _ownerSetEmergencyWithdrawTax(0); // 0%
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
        returns (uint256)
    {
        Require.that(
            ARB.balanceOf(address(this)) >= _amount + promisedArbTokens(),
            _FILE,
            "Not enough ARB tokens available"
        );
        Require.that(
            _duration >= _MIN_DURATION && _duration <= _MAX_DURATION && _duration % _MIN_DURATION == 0,
            _FILE,
            "Invalid duration"
        );

        // Create vesting position NFT
        uint256 nftId = _nextId() + 1;
        _setNextId(nftId);

        _createVestingPosition(
            VestingPosition({
                creator: msg.sender,
                id: nftId,
                startTime: block.timestamp,
                duration: _duration,
                amount: _amount
            })
        );
        _setPromisedArbTokens(promisedArbTokens() + _amount);

        _mint(msg.sender, nftId);
        // Transfer amounts in to hash of id and msg.sender
        oARB().safeTransferFrom(msg.sender, address(this), _amount);
        _transfer(
            /* fromAccount = */ msg.sender,
            /* fromAccountNumber = */ _fromAccountNumber,
            /* toAccount = */ address(this),
            /* toAccountNumber = */ uint256(keccak256(abi.encodePacked(msg.sender, nftId))),
            /* marketId */ ARB_MARKET_ID,
            /* amount */ _amount
        );

        emit Vesting(msg.sender, _duration, _amount, nftId);
        return nftId;
    }

    function closePositionAndBuyTokens(
        uint256 _id,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _maxPaymentAmount
    )
    external
    nonReentrant {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(position.creator, _id)));
        address positionOwner = ownerOf(_id);
        Require.that(
            positionOwner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        Require.that(
            block.timestamp > position.startTime + position.duration,
            _FILE,
            "Position not vested"
        );
        Require.that(
            block.timestamp <= position.startTime + position.duration + closePositionWindow(),
            _FILE,
            "Position expired"
        );

        _closePosition(position);

        // Burn oARB and deposit ARB tokens back into dolomite
        oARB().burn(position.amount);
        _transfer(
            /* fromAccount = */ address(this),
            /* fromAccountNumber = */ accountNumber,
            /* toAccount = */ positionOwner,
            /* toAccountNumber = */ _toAccountNumber,
            /* marketId */ ARB_MARKET_ID,
            /* amount */ position.amount
        );

        // Calculate price
        uint256 discount = _calculateDiscount(position.duration);
        uint256 wethPrice = DOLOMITE_MARGIN().getMarketPrice(WETH_MARKET_ID).value;
        uint256 arbPriceAdj = DOLOMITE_MARGIN().getMarketPrice(ARB_MARKET_ID).value * discount / _BASE;

        uint256 cost = position.amount * arbPriceAdj / wethPrice;
        Require.that(
            cost <= _maxPaymentAmount,
            _FILE,
            "Cost exceeds max payment amount"
        );

        _transfer(
            /* fromAccount = */ msg.sender,
            /* fromAccountNumber = */ _fromAccountNumber,
            /* toAccount = */ DOLOMITE_MARGIN().owner(),
            /* toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* marketId */ WETH_MARKET_ID,
            /* amount */ cost
        );

        // Deposit purchased ARB tokens into dolomite, clear vesting position, and refund
        _depositARBIntoDolomite(positionOwner, _toAccountNumber, position.amount);

        emit PositionClosed(positionOwner, _id, cost);
    }

    function forceClosePosition(
        uint256 _id
    )
    external
    onlyDolomiteMarginGlobalOperator(msg.sender) {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(position.creator, _id)));
        address positionOwner = ownerOf(_id);
        Require.that(
            block.timestamp > position.startTime + position.duration + closePositionWindow(),
            _FILE,
            "Position not expired"
        );

        _closePosition(position);

        // Burn oARB and transfer ARB tokens back to user"s dolomite account minus tax amount
        uint256 tax = position.amount * forceClosePositionTax() / _BASE;
        oARB().burn(position.amount);
        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ positionOwner,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ position.amount - tax
        );

        if (tax > 0) {
            _transfer(
                /* _fromAccount = */ address(this),
                /* _fromAccountNumber = */ accountNumber,
                /* _toAccount = */ DOLOMITE_MARGIN().owner(),
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                /* _marketId = */ ARB_MARKET_ID,
                /* _amountWei */ tax
            );
        }

        emit PositionForceClosed(positionOwner, _id);
    }

    // WARNING: This will forfeit all vesting progress and burn any locked oARB
    function emergencyWithdraw(uint256 _id) external {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        uint256 accountNumber = uint256(keccak256(abi.encodePacked(position.creator, _id)));
        address owner = ownerOf(_id);
        Require.that(
            owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );

        // Transfer arb back to the user and burn ARB
        oARB().burn(position.amount);
        uint256 tax = position.amount * emergencyWithdrawTax() / _BASE;
        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ owner,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ position.amount - tax
        );

        _closePosition(position);

        if (tax > 0) {
            _transfer(
                /* _fromAccount = */ address(this),
                /* _fromAccountNumber = */ accountNumber,
                /* _toAccount = */ DOLOMITE_MARGIN().owner(),
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                /* _marketId = */ ARB_MARKET_ID,
                /* _amountWei */ tax
            );
        }

        emit EmergencyWithdraw(owner, _id);
    }

    // ==================================================================
    // ======================= Admin Functions ==========================
    // ==================================================================

    function ownerSetIsVestingActive(
        bool _isVestingActive
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsVestingActive(_isVestingActive);
    }

    function ownerSetOARB(
        address _oARB
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetOARB(_oARB);
    }

    function ownerSetClosePositionWindow(
        uint256 _closePositionWindow
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetClosePositionWindow(_closePositionWindow);
    }

    function ownerSetEmergencyWithdrawTax(
        uint256 _emergencyWithdrawTax
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetEmergencyWithdrawTax(_emergencyWithdrawTax);
    }

    function ownerSetForceClosePositionTax(
        uint256 _forceClosePositionTax
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetForceClosePositionTax(_forceClosePositionTax);
    }

    // ==================================================================
    // ======================= View Functions ===========================
    // ==================================================================

    function availableArbTokens() public view returns (uint256) {
        return ARB.balanceOf(address(this)) - promisedArbTokens();
    }

    function promisedArbTokens() public view returns (uint256) {
        return _getUint256(_PROMISED_ARB_TOKENS_SLOT);
    }

    function oARB() public view returns (IOARB) {
        return IOARB(_getAddress(_OARB_SLOT));
    }

    function closePositionWindow() public view returns (uint256) {
        return _getUint256(_CLOSE_POSITION_WINDOW_SLOT);
    }

    function forceClosePositionTax() public view returns (uint256) {
        return _getUint256(_FORCE_CLOSE_POSITION_TAX_SLOT);
    }

    function emergencyWithdrawTax() public view returns (uint256) {
        return _getUint256(_EMERGENCY_WITHDRAW_TAX_SLOT);
    }

    function isVestingActive() public view returns (bool) {
        return _getUint256(_IS_VESTING_ACTIVE_SLOT) == 1;
    }

    function vestingPositions(uint256 _id) public pure returns (VestingPosition memory) {
        return _getVestingPositionSlot(_id);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetIsVestingActive(
        bool _isVestingActive
    )
    internal {
        _setUint256(_IS_VESTING_ACTIVE_SLOT, _isVestingActive ? 1 : 0);
        emit VestingActiveSet(_isVestingActive);
    }

    function _ownerSetOARB(address _oARB) internal {
        Require.that(
            promisedArbTokens() == 0,
            _FILE,
            "Outstanding vesting positions"
        );
        _setAddress(_OARB_SLOT, _oARB);
        emit OARBSet(_oARB);
    }

    function _ownerSetClosePositionWindow(uint256 _closePositionWindow) internal {
        Require.that(
            _closePositionWindow >= _MIN_DURATION,
            _FILE,
            "Invalid close position window"
        );
        _setUint256(_CLOSE_POSITION_WINDOW_SLOT, _closePositionWindow);
        emit ClosePositionWindowSet(_closePositionWindow);
    }

    function _ownerSetForceClosePositionTax(uint256 _forceClosePositionTax) internal {
        Require.that(
            _forceClosePositionTax >= 0 && _forceClosePositionTax < _BASE,
            _FILE,
            "Invalid force close position tax"
        );
        _setUint256(_FORCE_CLOSE_POSITION_TAX_SLOT, _forceClosePositionTax);
        emit ForceClosePositionTaxSet(_forceClosePositionTax);
    }

    function _ownerSetEmergencyWithdrawTax(
        uint256 _emergencyWithdrawTax
    )
    internal {
        Require.that(
            _emergencyWithdrawTax >= 0 && _emergencyWithdrawTax < _BASE,
            _FILE,
            "Invalid emergency withdrawal tax"
        );
        _setUint256(_EMERGENCY_WITHDRAW_TAX_SLOT, _emergencyWithdrawTax);
        emit EmergencyWithdrawTaxSet(_emergencyWithdrawTax);
    }

    function _closePosition(VestingPosition memory _position) internal {
        _setPromisedArbTokens(promisedArbTokens() - _position.amount);
        _burn(_position.id);
        _clearVestingPosition(_position.id);
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
        uint256 _toAccountNumber,
        uint256 _amount
    ) internal {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IERC20 arb = IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(ARB_MARKET_ID));
        arb.safeApprove(address(dolomiteMargin), _amount);
        AccountActionLib.deposit(
            dolomiteMargin,
            _account,
            /* _fromAccount = */ address(this),
            _toAccountNumber,
            ARB_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            })
        );
    }

    function _createVestingPosition(VestingPosition memory _vestingPosition) internal {
        VestingPosition storage vestingPosition = _getVestingPositionSlot(_vestingPosition.id);
        vestingPosition.creator = _vestingPosition.creator;
        vestingPosition.id = _vestingPosition.id;
        vestingPosition.startTime = _vestingPosition.startTime;
        vestingPosition.duration = _vestingPosition.duration;
        vestingPosition.amount = _vestingPosition.amount;
        emit VestingPositionCreated(_vestingPosition);
    }

    function _setPromisedArbTokens(uint256 _promisedArbTokens) internal {
        _setUint256(_PROMISED_ARB_TOKENS_SLOT, _promisedArbTokens);
        emit PromisedArbTokensSet(_promisedArbTokens);
    }

    function _clearVestingPosition(uint256 _id) internal {
        VestingPosition storage vestingPosition = _getVestingPositionSlot(_id);
        vestingPosition.creator = address(0);
        vestingPosition.id = 0;
        vestingPosition.startTime = 0;
        vestingPosition.duration = 0;
        vestingPosition.amount = 0;
        emit VestingPositionCleared(_id);
    }

    function _setNextId(uint256 _id) internal {
        _setUint256(_NEXT_ID_SLOT, _id);
    }

    function _nextId() internal view returns (uint256) {
        return _getUint256(_NEXT_ID_SLOT);
    }

    function _getVestingPositionSlot(uint256 _id) internal pure returns (VestingPosition storage vestingPosition) {
        bytes32 slot = keccak256(abi.encodePacked(_VESTING_POSITIONS_SLOT, _id));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            vestingPosition.slot := slot
        }
    }

    function _calculateDiscount(uint256 _duration) internal pure returns (uint256) {
        if (_duration == 1 weeks) {
            return 9_750;
        } else if (_duration == 2 weeks) {
            return 9_500;
        } else if (_duration == 3 weeks) {
            return 9_000;
        } else {
            assert(_duration == 4 weeks);
            return 8_000;
        }
    }
}
