// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { RouterBase } from "../routers/RouterBase.sol";
import { IStewardsRainAuthRouter } from "./IStewardsRainAuthRouter.sol";
import { IERC20WithAuthorization } from "../interfaces/IERC20WithAuthorization.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   StewardsRainAuthRouter
 * @author  Dolomite
 *
 * @notice  Router for handling Rain card authorization flows funded by borrowing USD stablecoin
 *          from a shared Stewards collateral vault on Dolomite Margin, with support for batched
 *          merchant repayments authorized via EIP-3009.
 */
contract StewardsRainAuthRouter is RouterBase, IStewardsRainAuthRouter {
    using SafeERC20 for IERC20;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 public constant SETTLEMENT_TYPE_IDENTIFIER = keccak256("Stewards.MerchantBatchRepayment.v1");
    uint256 public constant ONE_FACTOR_BPS = 10_000;
    uint256 public constant MAX_BATCH_SIZE = 128;

    // ========================================================
    // ======================= Storage ========================
    // ========================================================

    address public override owner;
    address public override rainFloat;
    address public override stewardsVaultOwner;
    uint256 public override stewardsVaultAccountNumber;
    uint256 public override usdcMarketId;

    mapping(address => bool) public override isRelayer;
    mapping(uint256 => bool) public override isBatchProcessed;
    mapping(uint256 => MerchantAccountState) public merchantAccounts;
    mapping(bytes32 => AuthRecord) public authRecords;

    // ========================================================
    // ===================== Modifiers ========================
    // ========================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        _;
    }

    // ========================================================
    // ===================== Constructor ======================
    // ========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {}

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function initialize(
        address _owner,
        address _rainFloat,
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber,
        uint256 _usdcMarketId
    ) external override initializer {
        if (_owner == address(0) || _rainFloat == address(0) || _stewardsVaultOwner == address(0)) {
            revert ZeroAddress();
        }

        __ReentrancyGuardUpgradeable__init();

        owner = _owner;
        isRelayer[_owner] = true;
        rainFloat = _rainFloat;
        stewardsVaultOwner = _stewardsVaultOwner;
        stewardsVaultAccountNumber = _stewardsVaultAccountNumber;
        usdcMarketId = _usdcMarketId;

        emit OwnerUpdated(address(0), _owner);
        emit RelayerUpdated(_owner, true);
        emit RainFloatUpdated(address(0), _rainFloat);
        emit StewardsVaultUpdated(_stewardsVaultOwner, _stewardsVaultAccountNumber, _usdcMarketId);
    }

    function setOwner(address _newOwner) external override onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();

        address oldOwner = owner;
        owner = _newOwner;

        emit OwnerUpdated(oldOwner, _newOwner);
    }

    function setRelayer(address _relayer, bool _allowed) external override onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();

        isRelayer[_relayer] = _allowed;

        emit RelayerUpdated(_relayer, _allowed);
    }

    function setRainFloat(address _rainFloat) external override onlyOwner {
        if (_rainFloat == address(0)) revert ZeroAddress();

        address oldFloat = rainFloat;
        rainFloat = _rainFloat;

        emit RainFloatUpdated(oldFloat, _rainFloat);
    }

    function setStewardsVault(
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber,
        uint256 _usdcMarketId
    ) external override onlyOwner {
        if (_stewardsVaultOwner == address(0)) revert ZeroAddress();

        stewardsVaultOwner = _stewardsVaultOwner;
        stewardsVaultAccountNumber = _stewardsVaultAccountNumber;
        usdcMarketId = _usdcMarketId;

        emit StewardsVaultUpdated(_stewardsVaultOwner, _stewardsVaultAccountNumber, _usdcMarketId);
    }

    function configureMerchantAccount(
        uint256 _merchantId,
        uint256 _merchantLimit,
        uint256 _factorBps,
        uint256 _outstandingPrincipal,
        uint256 _outstandingFactor,
        uint256 _dailySpent,
        uint256 _dailyLimit,
        bool _enabled
    ) external override onlyOwner {
        if (_factorBps < ONE_FACTOR_BPS) revert InvalidFactor();

        merchantAccounts[_merchantId] = MerchantAccountState({
            merchantLimit: _merchantLimit,
            factorBps: _factorBps,
            outstandingPrincipal: _outstandingPrincipal,
            outstandingFactor: _outstandingFactor,
            dailySpent: _dailySpent,
            dailyLimit: _dailyLimit,
            enabled: _enabled
        });

        emit MerchantConfigured(
            _merchantId,
            _merchantLimit,
            _factorBps,
            _outstandingPrincipal,
            _outstandingFactor,
            _dailySpent,
            _dailyLimit,
            _enabled
        );
    }

    /// @notice Authorizes and funds an Rain card transaction by borrowing USDC from Dolomite Margin.
    /// @param _authId Unique Rain/card auth id.
    /// @param _merchantId Merchant identifier.
    /// @param _amount Auth amount in USDC units.
    /// @param _authHash Hash of the Rain auth payload / payment context.
    function fundAuth(
        bytes32 _authId,
        uint256 _merchantId,
        uint256 _amount,
        bytes32 _authHash
    ) external override nonReentrant onlyRelayer returns (AuthStatus status, DeclineReason reason) {
        bytes32 paramsHash = keccak256(abi.encode(_merchantId, _amount, _authHash));

        AuthRecord storage existing = authRecords[_authId];

        if (existing.status != AuthStatus.NONE) {
            if (existing.paramsHash != paramsHash) {
                revert AuthReplayConflict(_authId);
            }

            emit AuthAlreadyResolved(
                _authId,
                existing.merchantId,
                existing.status,
                existing.reason,
                existing.amount,
                existing.authHash
            );

            return (existing.status, existing.reason);
        }

        MerchantAccountState storage acct = merchantAccounts[_merchantId];

        reason = _getDeclineReason(acct, _amount);

        if (reason != DeclineReason.NONE) {
            authRecords[_authId] = AuthRecord({
                status: AuthStatus.DECLINED,
                reason: reason,
                merchantId: _merchantId,
                amount: _amount,
                authHash: _authHash,
                paramsHash: paramsHash
            });

            emit AuthDeclined(_authId, _merchantId, _amount, _authHash, reason);

            return (AuthStatus.DECLINED, reason);
        }

        uint256 factorCost = (_amount * (acct.factorBps - ONE_FACTOR_BPS)) / ONE_FACTOR_BPS;

        acct.outstandingPrincipal += _amount;
        acct.outstandingFactor += factorCost;
        acct.dailySpent += _amount;

        authRecords[_authId] = AuthRecord({
            status: AuthStatus.FUNDED,
            reason: DeclineReason.NONE,
            merchantId: _merchantId,
            amount: _amount,
            authHash: _authHash,
            paramsHash: paramsHash
        });

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _amount
        });

        // TODO: can check about sending the funds here then doing a transfer/smart contract call on Rain
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            stewardsVaultOwner,
            stewardsVaultAccountNumber,
            rainFloat,
            usdcMarketId,
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.None
        );

        emit AuthFunded(_authId, _merchantId, _amount, _authHash);

        return (AuthStatus.FUNDED, DeclineReason.NONE);
    }

    /// @notice Executes batched repayment of merchant card balances using EIP-3009 authorization.
    function repayBatch(
        uint256 _batchId,
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts,
        RepaymentAuthParams calldata _authParams
    ) external override nonReentrant {
        uint256 length = _merchantIds.length;
        if (length == 0 || length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        if (length != _amounts.length) revert ArrayLengthMismatch();
        if (isBatchProcessed[_batchId]) revert BatchAlreadyProcessed(_batchId);
        if (_authParams.from == address(0)) revert ZeroAddress();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < length; ++i) {
            if (_amounts[i] == 0) revert InvalidRepaymentAmount();
            if (i > 0 && _merchantIds[i] <= _merchantIds[i - 1]) revert InvalidBatchOrder();
            totalAmount += _amounts[i];
        }

        isBatchProcessed[_batchId] = true;

        bytes32 batchDigest = calculateBatchDigest(_batchId, _merchantIds, _amounts);
        address usdcToken = DOLOMITE_MARGIN().getMarketTokenAddress(usdcMarketId);

        IERC20WithAuthorization(usdcToken).receiveWithAuthorization(
            _authParams.from,
            address(this),
            totalAmount,
            _authParams.validAfter,
            _authParams.validBefore,
            batchDigest,
            _authParams.v,
            _authParams.r,
            _authParams.s
        );

        IERC20(usdcToken).safeApprove(address(DOLOMITE_MARGIN()), totalAmount);

        IDolomiteStructs.AssetAmount memory depositAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: totalAmount
        });

        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            stewardsVaultOwner,
            address(this),
            stewardsVaultAccountNumber,
            usdcMarketId,
            depositAmount
        );

        _applyRepayments(_merchantIds, _amounts);

        emit BatchRepaid(_batchId, batchDigest, totalAmount, length);
    }

    function calculateBatchDigest(
        uint256 _batchId,
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts
    ) public view override returns (bytes32) {
        return keccak256(
            abi.encode(
                SETTLEMENT_TYPE_IDENTIFIER,
                _batchId,
                address(this),
                block.chainid,
                _merchantIds,
                _amounts
            )
        );
    }

    function getAuthRecord(bytes32 _authId) external view override returns (AuthRecord memory) {
        return authRecords[_authId];
    }

    function getMerchantAccount(uint256 _merchantId) external view override returns (MerchantAccountState memory) {
        return merchantAccounts[_merchantId];
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _applyRepayments(
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts
    ) internal {
        uint256 length = _merchantIds.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 merchantId = _merchantIds[i];
            uint256 paymentAmount = _amounts[i];
            MerchantAccountState storage acct = merchantAccounts[merchantId];

            uint256 principalPaid;
            uint256 factorPaid;

            if (acct.factorBps > 0) {
                principalPaid = (paymentAmount * ONE_FACTOR_BPS) / acct.factorBps;
                factorPaid = paymentAmount - principalPaid;
            } else {
                principalPaid = paymentAmount;
                factorPaid = 0;
            }

            if (principalPaid > acct.outstandingPrincipal) {
                principalPaid = acct.outstandingPrincipal;
                factorPaid = paymentAmount > principalPaid ? paymentAmount - principalPaid : 0;
            }
            if (factorPaid > acct.outstandingFactor) {
                factorPaid = acct.outstandingFactor;
            }

            acct.outstandingPrincipal -= principalPaid;
            acct.outstandingFactor -= factorPaid;

            emit MerchantRepaid(
                merchantId,
                paymentAmount,
                principalPaid,
                factorPaid,
                acct.outstandingPrincipal,
                acct.outstandingFactor
            );
        }
    }

    function _getDeclineReason(
        MerchantAccountState storage _acct,
        uint256 _amount
    ) internal view returns (DeclineReason) {
        if (!_acct.enabled) {
            return DeclineReason.ACCOUNT_DISABLED;
        }

        if (_acct.outstandingPrincipal + _amount > _acct.merchantLimit) {
            return DeclineReason.INSUFFICIENT_BALANCE;
        }

        if (_acct.dailyLimit != 0 && _acct.dailySpent + _amount > _acct.dailyLimit) {
            return DeclineReason.VELOCITY_LIMIT_EXCEEDED;
        }

        return DeclineReason.NONE;
    }
}
