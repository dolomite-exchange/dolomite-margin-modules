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
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ERC721EnumerableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol"; // solhint-disable-line max-line-length
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { VesterImplementationLibForV2 } from "./VesterImplementationLibForV2.sol";
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";
import { IVesterV2 } from "./interfaces/IVesterV2.sol";


/**
 * @title   VesterImplementationV2
 * @author  Dolomite
 *
 * An implementation of the IVesterV2 interface that allows users to buy ARB at a discount if they vest oARB for a
 * certain amount of time
 */
contract VesterImplementationV2 is
    ProxyContractHelpers,
    OnlyDolomiteMargin,
    ReentrancyGuard,
    ERC721EnumerableUpgradeable,
    IVesterV2
{
    using Address for address payable;
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Mintable;
    using VesterImplementationLibForV2 for VesterImplementationV2;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VesterImplementationV2";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _BASE = 10_000;

    bytes32 private constant _NEXT_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.nextId")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _VESTING_POSITIONS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vestingPositions")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PROMISED_TOKENS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.promisedTokens")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.token")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _CLOSE_POSITION_WINDOW_SLOT = bytes32(uint256(keccak256("eip1967.proxy.closePositionWindow")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _FORCE_CLOSE_POSITION_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.forceClosePositionTax")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _EMERGENCY_WITHDRAW_TAX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.emergencyWithdrawTax")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_VESTING_ACTIVE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isVestingActive")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _BASE_URI_SLOT = bytes32(uint256(keccak256("eip1967.proxy.baseURI")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _GRANDFATHERED_ID_CUTOFF_SLOT = bytes32(uint256(keccak256("eip1967.proxy.grandfatheredIdCutoff")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _NEXT_REQUEST_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.nextRequestId")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_HANDLER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isHandler")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_EXPIRATION_WINDOW_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelExpirationWindow")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_BY_USER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelByUser")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_REQUEST_BY_USER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelRequestByUser")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_EXPIRATION_TIMESTAMP_BY_USER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelExpirationTimestampByUser")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_REQUEST_FEE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelRequestFee")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _LEVEL_BOOST_THRESHOLD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.levelBoostThreshold")) - 1); // solhint-disable-line max-line-length

    // =========================================================
    // ==================== State Variables ====================
    // =========================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line
    IWETH public immutable WETH; // solhint-disable-line
    uint256 public immutable WETH_MARKET_ID; // solhint-disable-line
    IERC20 public immutable ARB; // solhint-disable-line
    uint256 public immutable ARB_MARKET_ID; // solhint-disable-line

    uint256 private immutable _MIN_VESTING_DURATION; // solhint-disable-line
    uint256 private immutable _MAX_VESTING_DURATION; // solhint-disable-line
    uint256 private immutable _OLD_MAX_VESTING_DURATION; // solhint-disable-line

    // =========================================================
    // ======================= Modifiers =======================
    // =========================================================

    modifier requireVestingActive() {
        _validateIsVestingActive();
        _;
    }

    modifier requireIsHandler(address _from) {
        _validateIsHandler(msg.sender);
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
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        WETH = _weth;
        WETH_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_weth));
        ARB = _arb;
        ARB_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_arb));

        _MIN_VESTING_DURATION = VesterImplementationLibForV2.minVestingDuration();
        _MAX_VESTING_DURATION = VesterImplementationLibForV2.maxVestingDuration();
        _OLD_MAX_VESTING_DURATION = VesterImplementationLibForV2.oldMaxVestingDuration();
    }

    function initialize(
        bytes calldata _data
    )
        external
        reinitializer(/* version = */ 2)
    {
        address _initialHandler = abi.decode(_data, (address));
        _setUint256(_GRANDFATHERED_ID_CUTOFF_SLOT, _nextNftId());
        _ownerSetLevelExpirationWindow(/* _levelExpirationWindow = */ 4 weeks);
        _ownerSetLevelRequestFee(/* _fee = */ 0.0003 ether);
        _ownerSetHandler(_initialHandler, /* _isHandler = */ true);
        _ownerSetLevelBoostThreshold(/* _level = */ 4);
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
            ARB.balanceOf(address(this)) >= _amount + promisedTokens(),
            _FILE,
            "Not enough ARB tokens available"
        );
        Require.that(
            _duration >= _MIN_VESTING_DURATION
                && _duration <= _MAX_VESTING_DURATION
                && _duration % _MIN_VESTING_DURATION == 0,
            _FILE,
            "Invalid duration"
        );

        // Create vesting position NFT
        uint256 nftId = _nextNftId() + 1;
        _setNextNftId(nftId);

        _createVestingPosition(
            VestingPosition({
                creator: msg.sender,
                id: nftId,
                startTime: block.timestamp,
                duration: _duration,
                amount: _amount
            })
        );
        _setPromisedTokens(promisedTokens() + _amount);

        _mint(msg.sender, nftId);
        IERC20(address(oToken())).safeTransferFrom(msg.sender, address(this), _amount);
        // Transfer amounts in to hash of id and msg.sender
        _transfer(
            /* fromAccount = */ msg.sender,
            /* fromAccountNumber = */ _fromAccountNumber,
            /* toAccount = */ address(this),
            /* toAccountNumber = */ uint256(keccak256(abi.encodePacked(msg.sender, nftId))),
            /* marketId */ ARB_MARKET_ID,
            /* amount */ _amount
        );

        emit VestingStarted(msg.sender, _duration, _amount, nftId);
        return nftId;
    }

    function extendDurationForPosition(uint256 _nftId, uint256 _duration) external {
        this.extendDurationForPosition(
            /* _vestingPosition = */ _getVestingPositionSlot(_nftId),
            _nftId,
            _duration
        );
    }

    function closePositionAndBuyTokens(
        uint256 _nftId,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _maxPaymentAmount
    )
    external
    nonReentrant {
        VestingPosition memory position = _getVestingPositionSlot(_nftId);
        uint256 accountNumber = _getAccountNumberByPosition(position);
        address positionOwner = ownerOf(_nftId);
        Require.that(
            positionOwner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        uint256 level = getEffectiveLevelByUser(positionOwner);
        Require.that(
            block.timestamp > position.startTime + _calculateEffectiveDuration(position.duration, level),
            _FILE,
            "Position not vested"
        );

        _closePosition(position);

        // Burn oARB and deposit ARB tokens back into dolomite
        oToken().burn(position.amount);
        _transfer(
            /* fromAccount = */ address(this),
            /* fromAccountNumber = */ accountNumber,
            /* toAccount = */ positionOwner,
            /* toAccountNumber = */ _toAccountNumber,
            /* marketId */ ARB_MARKET_ID,
            /* amount */ type(uint256).max
        );

        // Calculate price
        uint256 effectiveRate = this.calculateEffectiveRate(position.duration, _nftId);
        uint256 wethPrice = DOLOMITE_MARGIN().getMarketPrice(WETH_MARKET_ID).value;
        uint256 arbPriceAdj = DOLOMITE_MARGIN().getMarketPrice(ARB_MARKET_ID).value * effectiveRate / _BASE;

        uint256 cost = position.amount * arbPriceAdj / wethPrice;
        Require.that(
            cost <= _maxPaymentAmount,
            _FILE,
            "Cost exceeds max payment amount"
        );

        _transfer(
            /* fromAccount = */ positionOwner,
            /* fromAccountNumber = */ _fromAccountNumber,
            /* toAccount = */ DOLOMITE_MARGIN().owner(),
            /* toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* marketId */ WETH_MARKET_ID,
            /* amount */ cost
        );

        // Deposit purchased ARB tokens into dolomite, clear vesting position, and refund
        _depositARBIntoDolomite(positionOwner, _toAccountNumber, position.amount);

        emit PositionClosed(positionOwner, _nftId, cost);
    }

    function forceClosePosition(
        uint256 _nftId
    )
    external
    onlyDolomiteMarginGlobalOperator(msg.sender) {
        VestingPosition memory position = _getVestingPositionSlot(_nftId);
        uint256 accountNumber = _getAccountNumberByPosition(position);
        address positionOwner = ownerOf(_nftId);
        Require.that(
            block.timestamp > position.startTime + position.duration + closePositionWindow(),
            _FILE,
            "Position not expired"
        );

        _closePosition(position);

        // Burn oARB and transfer ARB tokens back to user"s dolomite account minus tax amount
        uint256 arbTax = position.amount * forceClosePositionTax() / _BASE;
        oToken().burn(position.amount);
        if (arbTax > 0) {
            _transfer(
                /* _fromAccount = */ address(this),
                /* _fromAccountNumber = */ accountNumber,
                /* _toAccount = */ DOLOMITE_MARGIN().owner(),
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                /* _marketId = */ ARB_MARKET_ID,
                /* _amountWei */ arbTax
            );
        }

        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ positionOwner,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ type(uint256).max
        );

        emit PositionForceClosed(positionOwner, _nftId, arbTax);
    }

    // WARNING: This will forfeit all vesting progress and burn any locked oARB
    function emergencyWithdraw(uint256 _nftId) external {
        VestingPosition memory position = _getVestingPositionSlot(_nftId);
        uint256 accountNumber = _getAccountNumberByPosition(position);
        address owner = ownerOf(_nftId);
        Require.that(
            owner == msg.sender,
            _FILE,
            "Invalid position owner"
        );

        // Transfer arb back to the user and burn ARB
        oToken().burn(position.amount);
        uint256 arbTax = position.amount * emergencyWithdrawTax() / _BASE;
        if (arbTax > 0) {
            _transfer(
                /* _fromAccount = */ address(this),
                /* _fromAccountNumber = */ accountNumber,
                /* _toAccount = */ DOLOMITE_MARGIN().owner(),
                /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
                /* _marketId = */ ARB_MARKET_ID,
                /* _amountWei */ arbTax
            );
        }

        _transfer(
            /* _fromAccount = */ address(this),
            /* _fromAccountNumber = */ accountNumber,
            /* _toAccount = */ owner,
            /* _toAccountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _marketId = */ ARB_MARKET_ID,
            /* _amountWei */ type(uint256).max
        );

        _closePosition(position);

        emit EmergencyWithdraw(owner, _nftId, arbTax);
    }

    function initiateLevelRequest(address _user) external payable {
        Require.that(
            msg.value == levelRequestFee(),
            _FILE,
            "Invalid fee"
        );
        Require.that(
            getLevelRequestByUser(_user) == 0,
            _FILE,
            "Request already initiated"
        );

        uint256 requestId = _nextRequestId() + 1;
        _setLevelRequestByUser(_user, requestId);

        _setNextRequestId(requestId);
        emit LevelRequestInitiated(_user, requestId);
    }

    // ==================================================================
    // ======================= Admin Functions ==========================
    // ==================================================================

    function ownerWithdrawToken(
        address _to,
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
        ARB.safeTransfer(_to, _amount);
    }

    function ownerSetIsVestingActive(
        bool _isVestingActive
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsVestingActive(_isVestingActive);
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

    function ownerSetLevelExpirationWindow(
        uint256 _levelExpirationWindow
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetLevelExpirationWindow(_levelExpirationWindow);
    }

    function ownerSetLevelRequestFee(
        uint256 _fee
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetLevelRequestFee(_fee);
    }

    function ownerSetLevelBoostThreshold(
        uint8 _levelBoostThreshold
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetLevelBoostThreshold(_levelBoostThreshold);
    }

    function ownerSetHandler(
        address _handler,
        bool _isHandler
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler, _isHandler);
    }

    // ==================================================================
    // ======================== Handler Functions =======================
    // ==================================================================

    function handlerUpdateLevel(
        uint256 _requestId,
        address _user,
        uint256 _level
    )
        external
        requireIsHandler(msg.sender)
    {
        Require.that(
            _requestId == 0 || _requestId == getLevelRequestByUser(_user),
            _FILE,
            "Invalid request ID"
        );

        _setLevelRequestByUser(_user, /* _requestId = */ 0);
        _setLevelByUser(_user, _level);
        _setLevelExpirationTimestampByUser(_user, block.timestamp + levelExpirationWindow());
        emit LevelRequestFinalized(_user, _requestId, _level);
    }

    function handlerWithdrawETH(
        address payable _to
    )
        external
        requireIsHandler(msg.sender)
    {
        _to.sendValue(address(this).balance);
    }

    // ==================================================================
    // ======================= View Functions ===========================
    // ==================================================================

    function availableTokens() public view returns (uint256) {
        return ARB.balanceOf(address(this)) - promisedTokens();
    }

    function promisedTokens() public view returns (uint256) {
        return _getUint256(_PROMISED_TOKENS_SLOT);
    }

    function oToken() public view returns (IERC20Mintable) {
        return IERC20Mintable(_getAddress(_TOKEN_SLOT));
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

    function levelRequestFee() public view returns (uint256) {
        return _getUint256(_LEVEL_REQUEST_FEE_SLOT);
    }

    function levelBoostThreshold() public view returns (uint8) {
        return uint8(_getUint256(_LEVEL_BOOST_THRESHOLD_SLOT));
    }

    function grandfatheredIdCutoff() public view returns (uint256) {
        return _getUint256(_GRANDFATHERED_ID_CUTOFF_SLOT);
    }

    function levelExpirationWindow() public view returns (uint256) {
        return _getUint256(_LEVEL_EXPIRATION_WINDOW_SLOT);
    }

    function getLevelByUser(address _user) public view returns (uint256) {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_BY_USER_SLOT, _user));
        return _getUint256(slot);
    }

    function getEffectiveLevelByUser(address _user) public view returns (uint256) {
        uint256 expirationTimestamp = getLevelExpirationTimestampByUser(_user);
        if (expirationTimestamp == 0 || block.timestamp > expirationTimestamp) {
            // If there's no expiration timestamp or if it's expired, return 0
            return 0;
        }

        return getLevelByUser(_user);
    }

    function getLevelRequestByUser(address _user) public view returns (uint256) {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_REQUEST_BY_USER_SLOT, _user));
        return _getUint256(slot);
    }

    function getLevelExpirationTimestampByUser(address _user) public view returns (uint256) {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_EXPIRATION_TIMESTAMP_BY_USER_SLOT, _user));
        return _getUint256(slot);
    }

    function isHandler(address _handler) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_IS_HANDLER_SLOT, _handler));
        return _getUint256(slot) == 1;
    }

    function vestingPositions(uint256 _nftId) public pure returns (VestingPosition memory) {
        return _getVestingPositionSlot(_nftId);
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

    function _ownerSetClosePositionWindow(uint256 _closePositionWindow) internal {
        Require.that(
            _closePositionWindow >= _MIN_VESTING_DURATION,
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

    function _ownerSetLevelExpirationWindow(uint256 _levelExpirationWindow) internal {
        Require.that(
            _levelExpirationWindow >= _MIN_VESTING_DURATION,
            _FILE,
            "Invalid level expiration window"
        );
        _setUint256(_LEVEL_EXPIRATION_WINDOW_SLOT, _levelExpirationWindow);
        emit LevelExpirationWindowSet(_levelExpirationWindow);
    }

    function _ownerSetLevelRequestFee(uint256 _fee) internal {
        Require.that(
            _fee < 0.1 ether,
            _FILE,
            "Level request fee too large"
        );
        _setUint256(_LEVEL_REQUEST_FEE_SLOT, _fee);
        emit LevelRequestFeeSet(_fee);
    }

    function _ownerSetLevelBoostThreshold(uint8 _levelBoostThreshold) internal {
        _setUint256(_LEVEL_BOOST_THRESHOLD_SLOT, _levelBoostThreshold);
        emit LevelBoostThresholdSet(_levelBoostThreshold);
    }

    function _ownerSetHandler(address _handler, bool _isHandler) internal {
        bytes32 slot = keccak256(abi.encodePacked(_IS_HANDLER_SLOT, _handler));
        _setUint256(slot, _isHandler ? 1 : 0);
        emit HandlerSet(_handler, _isHandler);
    }

    function _closePosition(VestingPosition memory _position) internal {
        _setPromisedTokens(promisedTokens() - _position.amount);
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
        uint256 amountToTransfer = _amount;
        if (_amount == type(uint256).max) {
            IDolomiteStructs.AccountInfo memory fromAccountInfo = IDolomiteStructs.AccountInfo({
                owner: _fromAccount,
                number: _fromAccountNumber
            });
            amountToTransfer = DOLOMITE_MARGIN().getAccountWei(fromAccountInfo, _marketId).value;
        }
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            _fromAccount,
            _fromAccountNumber,
            _toAccount,
            _toAccountNumber,
            _marketId,
            IDolomiteStructs.AssetDenomination.Wei,
            amountToTransfer,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function _depositARBIntoDolomite(
        address _account,
        uint256 _toAccountNumber,
        uint256 _amount
    ) internal {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        ARB.safeApprove(address(dolomiteMargin), _amount);
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

    function _setPromisedTokens(uint256 _promisedTokens) internal {
        _setUint256(_PROMISED_TOKENS_SLOT, _promisedTokens);
        emit PromisedTokensSet(_promisedTokens);
    }

    function _clearVestingPosition(uint256 _nftId) internal {
        VestingPosition storage vestingPosition = _getVestingPositionSlot(_nftId);
        vestingPosition.creator = address(0);
        vestingPosition.id = 0;
        vestingPosition.startTime = 0;
        vestingPosition.duration = 0;
        vestingPosition.amount = 0;
        emit VestingPositionCleared(_nftId);
    }

    function _setNextNftId(uint256 _nftId) internal {
        _setUint256(_NEXT_ID_SLOT, _nftId);
    }

    function _setNextRequestId(uint256 _requestId) internal {
        _setUint256(_NEXT_REQUEST_ID_SLOT, _requestId);
    }

    function _setLevelByUser(address _user, uint256 _level) internal {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_BY_USER_SLOT, _user));
        _setUint256(slot, _level);
    }

    function _setLevelRequestByUser(address _user, uint256 _requestId) internal {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_REQUEST_BY_USER_SLOT, _user));
        _setUint256(slot, _requestId);
    }

    function _setLevelExpirationTimestampByUser(address _user, uint256 _expirationTimestamp) internal {
        bytes32 slot = keccak256(abi.encodePacked(_LEVEL_EXPIRATION_TIMESTAMP_BY_USER_SLOT, _user));
        _setUint256(slot, _expirationTimestamp);
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

    function _nextNftId() internal view returns (uint256) {
        return _getUint256(_NEXT_ID_SLOT);
    }

    function _nextRequestId() internal view returns (uint256) {
        return _getUint256(_NEXT_REQUEST_ID_SLOT);
    }

    function _validateIsVestingActive() internal view {
        Require.that(
            isVestingActive(),
            _FILE,
            "Vesting not active"
        );
    }

    function _validateIsHandler(address _from) internal view {
        Require.that(
            isHandler(_from),
            _FILE,
            "Invalid handler",
            _from
        );
    }

    function _calculateEffectiveDuration(uint256 _duration, uint256 _level) internal view returns (uint256) {
        if (_level >= levelBoostThreshold()) {
            // A 50% increase in speed is the same thing as multiplying the value by 2/3
            return _duration * 2 / 3;
        } else {
            return _duration;
        }
    }

    function _getVestingPositionSlot(uint256 _nftId) internal pure returns (VestingPosition storage vestingPosition) {
        bytes32 slot = keccak256(abi.encodePacked(_VESTING_POSITIONS_SLOT, _nftId));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            vestingPosition.slot := slot
        }
    }

    function _getAccountNumberByPosition(VestingPosition memory _position) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_position.creator, _position.id)));
    }
}
