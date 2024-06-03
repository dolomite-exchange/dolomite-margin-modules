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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { ReentrancyGuardUpgradeable } from "@dolomite-exchange/modules-base/contracts/helpers/ReentrancyGuardUpgradeable.sol"; // solhint-disable-line max-line-length
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ERC721EnumerableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";
import { IVeExternalVesterV1 } from "./interfaces/IVeExternalVesterV1.sol";
import { IVesterDiscountCalculator } from "./interfaces/IVesterDiscountCalculator.sol";

/**
 * @title   VeExternalVesterImplementationV1
 * @author  Dolomite
 *
 * @notice  An implementation of the IVeExternalVesterV1 interface that allows users to buy PAIR_TOKEN at a discount if
 *          they vest PAIR_TOKEN and oToken for a certain amount of time.
 */
contract VeExternalVesterImplementationV1 is
    ProxyContractHelpers,
    OnlyDolomiteMargin,
    ReentrancyGuardUpgradeable,
    ERC721EnumerableUpgradeable,
    IVeExternalVesterV1
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Mintable;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VeExternalVesterImplementationV1";
    uint256 private constant _BASE = 10_000;
    uint256 private constant _NO_MARKET_ID = -1;

    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _VEST_DURATION = 4 weeks;

    // solhint-disable max-line-length
    bytes32 private constant _BASE_URI_SLOT = bytes32(uint256(keccak256("eip1967.proxy.baseURI")) - 1);
    bytes32 private constant _CLOSE_POSITION_WINDOW_SLOT = bytes32(uint256(keccak256("eip1967.proxy.closePositionWindow")) - 1);
    bytes32 private constant _DISCOUNT_CALCULATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.discountCalculator")) - 1);
    bytes32 private constant _EMERGENCY_WITHDRAW_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.emergencyWithdrawTax")) - 1);
    bytes32 private constant _FORCE_CLOSE_POSITION_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.forceClosePositionTax")) - 1);
    bytes32 private constant _IS_VESTING_ACTIVE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isVestingActive")) - 1);
    bytes32 private constant _NEXT_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.nextId")) - 1);
    bytes32 private constant _O_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.oToken")) - 1);
    bytes32 private constant _PROMISED_TOKENS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.promisedTokens")) - 1);
    bytes32 private constant _PUSHED_TOKENS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pushedTokens")) - 1);
    bytes32 private constant _VERSION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.version")) - 1);
    bytes32 private constant _VESTING_POSITIONS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vestingPositions")) - 1);
    // solhint-enable max-line-length

    // =========================================================
    // ================== Immutable Variables ==================
    // =========================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line
    IERC20 public override immutable PAIR_TOKEN; // solhint-disable-line
    uint256 public override immutable PAIR_MARKET_ID; // solhint-disable-line
    IERC20 public override immutable PAYMENT_TOKEN; // solhint-disable-line
    uint256 public override immutable PAYMENT_MARKET_ID; // solhint-disable-line
    IERC20 public override immutable REWARD_TOKEN; // solhint-disable-line
    uint256 public override immutable REWARD_MARKET_ID; // solhint-disable-line
    address public override immutable VE_TOKEN; // solhint-disable-line

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
        IERC20 _pairToken,
        uint256 _pairMarketId,
        IERC20 _paymentToken,
        uint256 _paymentMarketId,
        IERC20 _rewardToken,
        uint256 _rewardMarketId,
        address _veToken
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        PAIR_TOKEN = _pairToken;
        PAIR_MARKET_ID = _pairMarketId;
        PAYMENT_TOKEN = _paymentToken;
        PAYMENT_MARKET_ID = _paymentMarketId;
        REWARD_TOKEN = _rewardToken;
        REWARD_MARKET_ID = _rewardMarketId;
        VE_TOKEN = _veToken;
    }

    function initialize(
        bytes calldata _data
    )
        external
        initializer
    {
        (
            address _discountCalculator,
            address _oToken,
            string memory _baseUri,
            string memory _name,
            string memory _symbol
        ) = abi.decode(_data, (address, address, string, string, string));
        _ownerSetIsVestingActive(true);
        _ownerSetDiscountCalculator(_discountCalculator);
        _ownerSetOToken(_oToken);
        _ownerSetClosePositionWindow(0 weeks);
        _ownerSetForceClosePositionTax(500); // 5%
        _ownerSetEmergencyWithdrawTax(0); // 0%
        _ownerSetBaseURI(_baseUri);
        __ERC721_init(_name, _symbol);
        __ReentrancyGuardUpgradeable__init();
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function vest(
        uint256 _duration,
        uint256 _oTokenAmount,
        uint256 _maxPairAmount
    )
        external
        requireVestingActive
        nonReentrant
        returns (uint256)
    {
        _validateEnoughRewardsAvailable(_oTokenAmount);
        Require.that(
            _duration == _VEST_DURATION,
            _FILE,
            "Invalid duration"
        );

        // Create vesting position NFT
        uint256 nftId = _nextId() + 1;
        _setNextId(nftId);

        uint256 pairPrice = DOLOMITE_REGISTRY.oracleAggregator().getPrice(PAIR_TOKEN).value;
        uint256 rewardPrice = DOLOMITE_REGISTRY.oracleAggregator().getPrice(REWARD_TOKEN).value;
        uint256 pairAmount = _oTokenAmount * rewardPrice / pairPrice;
        Require.that(
            pairAmount <= _maxPairAmount,
            _FILE,
            "Pair amount exceeds max"
        );

        _createVestingPosition(
            VestingPosition({
                creator: msg.sender,
                id: nftId,
                startTime: block.timestamp,
                duration: _duration,
                oTokenAmount: _oTokenAmount,
                pairAmount: pairAmount
            })
        );
        _setPromisedTokens(promisedTokens() + _oTokenAmount);

        _mint(msg.sender, nftId);
        IERC20(address(oToken())).safeTransferFrom(msg.sender, address(this), _oTokenAmount);
        PAIR_TOKEN.safeTransferFrom(msg.sender, address(this), pairAmount);
        _depositIntoDolomite(
            /* _toAccountOwner = */ address(this),
            /* _toAccountNumber = */ calculateAccountNumber(msg.sender, nftId),
            /* _token = */ PAIR_TOKEN,
            /* _marketId */ PAIR_MARKET_ID,
            /* _amount */ pairAmount
        );

        emit VestingStarted(msg.sender, _duration, _oTokenAmount, pairAmount, nftId);
        return nftId;
    }

    function closePositionAndBuyTokens(
        uint256 _id,
        uint256 _maxPaymentAmount
    )
    external
    nonReentrant {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        uint256 accountNumber = calculateAccountNumber(position.creator, _id);
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

        _closePosition(position);

        // Burn oToken and deposit PAIR_TOKEN tokens back into dolomite
        oToken().burn(position.oTokenAmount);

        // Deposit payment tokens into Dolomite
        uint256 paymentAmount = _doPaymentForVestExecution(
            position.id,
            position.duration,
            position.oTokenAmount,
            positionOwner,
            _maxPaymentAmount
        );

        // Withdraw pair tokens from dolomite, going to account
        _withdrawFromDolomite(
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ positionOwner,
            PAIR_TOKEN,
            PAIR_MARKET_ID,
            /* _amount */ type(uint256).max
        );

        // Withdraw reward tokens from Dolomite, going to account
        _withdrawFromDolomite(
            /* _fromAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _toAccount = */ positionOwner,
            /* _marketId */ REWARD_MARKET_ID,
            /* amount */ position.oTokenAmount
        );

        emit PositionClosed(positionOwner, _id, paymentAmount);
    }

    function forceClosePosition(
        uint256 _id
    )
    external {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        address positionOwner = ownerOf(_id);
        Require.that(
            closePositionWindow() != 0,
            _FILE,
            "Positions are not expirable"
        );
        Require.that(
            block.timestamp > position.startTime + position.duration + closePositionWindow(),
            _FILE,
            "Position not expired"
        );

        _closePosition(position);
        uint256 pairTokenTax = _doPairTokenPaymentsWithTax(position, positionOwner, forceClosePositionTax());
        emit PositionForceClosed(positionOwner, _id, pairTokenTax);
    }

    // WARNING: This will forfeit all vesting progress and burn any locked oToken
    function emergencyWithdraw(uint256 _id) external {
        VestingPosition memory position = _getVestingPositionSlot(_id);
        address positionOwner = ownerOf(_id);
        Require.that(
            positionOwner == msg.sender,
            _FILE,
            "Invalid position owner"
        );

        _closePosition(position);
        uint256 pairTokenTax = _doPairTokenPaymentsWithTax(position, positionOwner, emergencyWithdrawTax());
        emit EmergencyWithdraw(positionOwner, _id, pairTokenTax);
    }

    // ==================================================================
    // ======================= Admin Functions ==========================
    // ==================================================================

    function ownerDepositRewardToken(
        uint256 _amount
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            DOLOMITE_MARGIN().getIsLocalOperator(msg.sender, address(this)),
            _FILE,
            "Vester is not operator for owner"
        );
        REWARD_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        _depositIntoDolomite(
            /* _toAccountOwner = */ address(this),
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            REWARD_TOKEN,
            REWARD_MARKET_ID,
            _amount
        );
    }

    function ownerWithdrawRewardToken(
        address _toAccount,
        uint256 _amount,
        bool _shouldBypassAvailableAmounts
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (!_shouldBypassAvailableAmounts) {
            Require.that(
                _amount <= availableTokens(),
                _FILE,
                "Insufficient available tokens"
            );
        }
        _withdrawFromDolomite(
            _DEFAULT_ACCOUNT_NUMBER,
            /* _toAccount */ _toAccount,
            REWARD_MARKET_ID,
            _amount
        );
    }

    function ownerAccrueRewardTokenInterest(address _toAccount) external onlyDolomiteMarginOwner(msg.sender) {
        // all tokens have been spent
        Require.that(
            pushedTokens() == 0,
            _FILE,
            "Interest cannot be withdrawn yet",
            pushedTokens()
        );

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Target,
            value: 0
        });

        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ address(this),
            /* _fromAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _toAccount = */ _toAccount,
            REWARD_MARKET_ID,
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function ownerSetIsVestingActive(
        bool _isVestingActive
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsVestingActive(_isVestingActive);
    }

    function ownerSetDiscountCalculator(
        address _discountCalculator
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDiscountCalculator(_discountCalculator);
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

    function ownerSetBaseURI(
        string memory _baseUri
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBaseURI(_baseUri);
    }

    // ==================================================================
    // ======================= View Functions ===========================
    // ==================================================================

    function availableTokens() public view returns (uint256) {
        return pushedTokens() - promisedTokens();
    }

    function promisedTokens() public view returns (uint256) {
        return _getUint256(_PROMISED_TOKENS_SLOT);
    }

    function pushedTokens() public view returns (uint256) {
        return _getUint256(_PUSHED_TOKENS_SLOT);
    }

    function discountCalculator() public view returns (IVesterDiscountCalculator) {
        return IVesterDiscountCalculator(_getAddress(_DISCOUNT_CALCULATOR_SLOT));
    }

    function oToken() public view returns (IERC20Mintable) {
        return IERC20Mintable(_getAddress(_O_TOKEN_SLOT));
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

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        _requireMinted(_tokenId);
        return baseURI();
    }

    function baseURI() public view returns (string memory) {
        return _baseURI();
    }

    function calculateAccountNumber(address _creator, uint256 _id) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_creator, _id)));
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

    function _ownerSetDiscountCalculator(
        address _discountCalculator
    )
    internal {
        Require.that(
            _discountCalculator != address(0),
            _FILE,
            "Invalid discount calculator"
        );
        _setAddress(_DISCOUNT_CALCULATOR_SLOT, _discountCalculator);
        emit DiscountCalculatorSet(_discountCalculator);
    }

    function _ownerSetOToken(address _oToken) internal {
        // DANGER: this should be called VERY carefully.
        // Should not change the oToken when there are promised tokens.
        assert(promisedTokens() == 0);
        _setAddress(_O_TOKEN_SLOT, _oToken);
        emit OTokenSet(_oToken);
    }

    function _ownerSetClosePositionWindow(uint256 _closePositionWindow) internal {
        Require.that(
            _closePositionWindow >= _MIN_DURATION || _closePositionWindow == 0,
            _FILE,
            "Invalid close position window"
        );
        _setUint256(_CLOSE_POSITION_WINDOW_SLOT, _closePositionWindow);
        emit ClosePositionWindowSet(_closePositionWindow);
    }

    function _ownerSetForceClosePositionTax(uint256 _forceClosePositionTax) internal {
        Require.that(
            _forceClosePositionTax < _BASE,
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
            _emergencyWithdrawTax < _BASE,
            _FILE,
            "Invalid emergency withdrawal tax"
        );
        _setUint256(_EMERGENCY_WITHDRAW_TAX_SLOT, _emergencyWithdrawTax);
        emit EmergencyWithdrawTaxSet(_emergencyWithdrawTax);
    }

    function _ownerSetBaseURI(string memory _baseUri) internal {
        bytes32 slot = _BASE_URI_SLOT;
        BaseUriStorage storage baseUriStorage;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            baseUriStorage.slot := slot
        }
        baseUriStorage.baseUri = _baseUri;
        emit BaseURISet(_baseUri);
    }

    function _closePosition(VestingPosition memory _position) internal {
        _setPromisedTokens(promisedTokens() - _position.oTokenAmount);
        _burn(_position.id);
        _clearVestingPosition(_position.id);
    }

    function _doPaymentForVestExecution(
        uint256 _nftId,
        uint256 _duration,
        uint256 _oTokenAmount,
        address _positionOwner,
        uint256 _maxPaymentAmount
    ) internal returns (uint256 paymentAmount) {
        // Calculate price
        uint256 rewardPriceAdj = _getRewardPriceAdj(_nftId, _duration);
        uint256 paymentPrice = DOLOMITE_REGISTRY.oracleAggregator().getPrice(PAYMENT_TOKEN).value;
        paymentAmount = _oTokenAmount * rewardPriceAdj / paymentPrice;
        Require.that(
            paymentAmount <= _maxPaymentAmount,
            _FILE,
            "Cost exceeds max payment amount"
        );

        // Deposit payment tokens into Dolomite, going to DOLOMITE_MARGIN_OWNER()
        PAYMENT_TOKEN.safeTransferFrom(_positionOwner, address(this), paymentAmount);
        _depositIntoDolomite(
            /* _toAccountOwner = */ DOLOMITE_MARGIN_OWNER(),
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _token = */ PAYMENT_TOKEN,
            /* _marketId */ PAYMENT_MARKET_ID,
            /* _amount */ paymentAmount
        );

        return paymentAmount;
    }

    function _doPairTokenPaymentsWithTax(
        VestingPosition memory _position,
        address _positionOwner,
        uint256 _taxNumerator
    ) internal returns (uint256 pairTokenTax) {
        oToken().burn(_position.oTokenAmount);

        _withdrawFromDolomite(
            /* _fromAccountNumber = */ calculateAccountNumber(_position.creator, _position.id),
            /* _toAccount = */ address(this),
            PAIR_TOKEN,
            PAIR_MARKET_ID,
            _position.pairAmount
        );

        // Withdraw the rest to collect the interest
        uint256 balanceBefore = PAIR_TOKEN.balanceOf(address(this));
        _withdrawFromDolomite(
            /* _fromAccountNumber = */ calculateAccountNumber(_position.creator, _position.id),
            /* _toAccount = */ address(this),
            PAIR_TOKEN,
            PAIR_MARKET_ID,
            type(uint256).max
        );
        uint256 pairAmountInterest = PAIR_TOKEN.balanceOf(address(this)) - balanceBefore;

        // Only pay tax on the original pair amount
        pairTokenTax = _position.pairAmount * _taxNumerator / _BASE;
        if (pairTokenTax > 0) {
            _depositIntoDolomite(
                /* _toAccountOwner = */ DOLOMITE_MARGIN_OWNER(),
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                PAIR_TOKEN,
                PAIR_MARKET_ID,
                pairTokenTax
            );
        }
        PAIR_TOKEN.safeTransfer(_positionOwner, _position.pairAmount + pairAmountInterest - pairTokenTax);
    }

    function _depositIntoDolomite(
        address _toAccountOwner,
        uint256 _toAccountNumber,
        IERC20 _token,
        uint256 _marketId,
        uint256 _amount
    ) internal {
        if (
            _toAccountOwner == address(this) &&
            _toAccountNumber == _DEFAULT_ACCOUNT_NUMBER &&
            _marketId == REWARD_MARKET_ID
        ) {
            _setPushedTokens(pushedTokens() + _amount);
        }

        if (_marketId == _NO_MARKET_ID) {
            // Guard statement for _NO_MARKET_ID
            if (_toAccountOwner == DOLOMITE_MARGIN_OWNER()) {
                _token.safeTransfer(_toAccountOwner, _amount);
            }
            return;
        }

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();

        assert(dolomiteMargin.getMarketTokenAddress(_marketId) == address(_token));
        _token.safeApprove(address(dolomiteMargin), _amount);

        AccountActionLib.deposit(
            dolomiteMargin,
            /* _accountOwner = */ _toAccountOwner,
            /* _fromAccount = */ address(this),
            _toAccountNumber,
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            })
        );
    }

    function _withdrawFromDolomite(
        uint256 _fromAccountNumber,
        address _toAccount,
        IERC20 _token,
        uint256 _marketId,
        uint256 _amount
    ) internal {
        if (
            _fromAccountNumber == _DEFAULT_ACCOUNT_NUMBER &&
            _marketId == REWARD_MARKET_ID
        ) {
            _setPushedTokens(pushedTokens() - _amount);
        }

        if (_marketId == _NO_MARKET_ID) {
            if (_amount != type(uint256).max) {
                // Guard statement for _NO_MARKET_ID
                _token.safeTransfer(_toAccount, _amount);
            }
            return;
        }

        IDolomiteStructs.AssetAmount memory assetAmount;
        if (_amount == type(uint256).max) {
            assetAmount = IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Par,
                ref: IDolomiteStructs.AssetReference.Target,
                value: 0
            });
        } else {
            assetAmount = IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            });
        }
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ address(this),
            /* _fromAccountNumber = */ _fromAccountNumber,
            /* _toAccount = */ _toAccount,
            _marketId,
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function _createVestingPosition(VestingPosition memory _vestingPosition) internal {
        VestingPosition storage vestingPosition = _getVestingPositionSlot(_vestingPosition.id);
        vestingPosition.creator = _vestingPosition.creator;
        vestingPosition.id = _vestingPosition.id;
        vestingPosition.startTime = _vestingPosition.startTime;
        vestingPosition.duration = _vestingPosition.duration;
        vestingPosition.oTokenAmount = _vestingPosition.oTokenAmount;
        vestingPosition.pairAmount = _vestingPosition.pairAmount;
        emit VestingPositionCreated(_vestingPosition);
    }

    function _setPromisedTokens(uint256 _promisedTokens) internal {
        _setUint256(_PROMISED_TOKENS_SLOT, _promisedTokens);
        emit PromisedTokensSet(_promisedTokens);
    }

    function _setPushedTokens(uint256 _pushedTokens) internal {
        _setUint256(_PUSHED_TOKENS_SLOT, _pushedTokens);
        emit PushedTokensSet(_pushedTokens);
    }

    function _clearVestingPosition(uint256 _id) internal {
        VestingPosition storage vestingPosition = _getVestingPositionSlot(_id);
        vestingPosition.creator = address(0);
        vestingPosition.id = 0;
        vestingPosition.startTime = 0;
        vestingPosition.duration = 0;
        vestingPosition.oTokenAmount = 0;
        vestingPosition.pairAmount = 0;
        emit VestingPositionCleared(_id);
    }

    function _setNextId(uint256 _id) internal {
        _setUint256(_NEXT_ID_SLOT, _id);
    }

    function _baseURI() internal view override returns (string memory) {
        bytes32 slot = _BASE_URI_SLOT;
        BaseUriStorage storage baseUriStorage;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            baseUriStorage.slot := slot
        }
        return baseUriStorage.baseUri;
    }

    function _nextId() internal view returns (uint256) {
        return _getUint256(_NEXT_ID_SLOT);
    }

    function _getRewardPriceAdj(uint256 _nftId, uint256 _duration) internal view returns (uint256) {
        uint256 discount = discountCalculator().calculateDiscount(_nftId, _duration);
        Require.that(
            discount <= _BASE,
            _FILE,
            "Invalid discount",
            discount
        );

        uint256 rewardPrice = DOLOMITE_REGISTRY.oracleAggregator().getPrice(REWARD_TOKEN).value;
        return rewardPrice - (rewardPrice * discount / _BASE);
    }

    function _validateEnoughRewardsAvailable(uint256 _oTokenAmount) internal view {
        Require.that(
            pushedTokens() >= _oTokenAmount + promisedTokens(),
            _FILE,
            "Not enough rewards available"
        );
    }

    function _getVestingPositionSlot(uint256 _id) internal pure returns (VestingPosition storage vestingPosition) {
        bytes32 slot = keccak256(abi.encodePacked(_VESTING_POSITIONS_SLOT, _id));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            vestingPosition.slot := slot
        }
    }
}
