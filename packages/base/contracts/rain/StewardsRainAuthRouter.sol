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

import { Require } from "../protocol/lib/Require.sol";
import { RouterBase } from "../routers/RouterBase.sol";
import { IStewardsRainAuthRouter } from "./IStewardsRainAuthRouter.sol";
import { IERC20WithAuthorization } from "../interfaces/IERC20WithAuthorization.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";

import "hardhat/console.sol";

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

    bytes32 private constant _FILE = "StewardsRainAuthRouter";

    bytes32 public constant SETTLEMENT_TYPE_IDENTIFIER = keccak256("Stewards.MerchantBatchRepayment.v1");
    uint256 public constant ONE_FACTOR_BPS = 10_000;
    uint256 public constant MAX_BATCH_SIZE = 128;

    uint256 public immutable USDC_MARKET_ID;

    // ========================================================
    // ======================= Storage ========================
    // ========================================================

    address public override rainFloat;
    address public override stewardsVaultOwner;
    uint256 public override stewardsVaultAccountNumber;

    mapping(address => bool) public override isRelayer;
    mapping(uint256 => bool) public override isBatchProcessed;
    mapping(uint256 => MerchantAccountState) public merchantAccounts;
    mapping(bytes32 => AuthRecord) public authRecords;

    // ========================================================
    // ===================== Modifiers ========================
    // ========================================================

    modifier onlyRelayer(address _caller) {
        if (!isRelayer[_caller]) revert NotRelayer();
        _;
    }

    // ========================================================
    // ===================== Constructor ======================
    // ========================================================

    constructor(
        uint256 _usdcMarketId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
        USDC_MARKET_ID = _usdcMarketId;
    }

    // ========================================================
    // ====================== Initializer =====================
    // ========================================================

    function initialize(
        address _relayer,
        address _rainFloat,
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber
    ) external override initializer {
        __ReentrancyGuardUpgradeable__init();

        _ownerSetRelayer(_relayer, true);
        _ownerSetRainFloat(_rainFloat);
        _ownerSetStewardsVault(_stewardsVaultOwner, _stewardsVaultAccountNumber);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

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
    ) external override nonReentrant onlyRelayer(msg.sender) returns (AuthStatus status, DeclineReason reason) {
        bytes32 paramsHash = keccak256(abi.encode(_merchantId, _amount, _authHash));
        AuthRecord storage auth = authRecords[_authId];
        MerchantAccountState storage acct = merchantAccounts[_merchantId];

        if (auth.status != AuthStatus.NONE) {
            Require.that(
                auth.paramsHash == paramsHash,
                _FILE,
                "Auth Replay Conflict",
                _authId
            );

            emit AuthAlreadyResolved(
                _authId,
                auth.merchantId,
                auth.status,
                auth.reason,
                auth.amount,
                auth.authHash
            );

            return (auth.status, auth.reason);
        }

        if (!acct.enabled) {
            return _declineAuth(_authId, _merchantId, _amount, _authHash, paramsHash, DeclineReason.ACCOUNT_DISABLED);
        }

        if (acct.outstandingPrincipal + _amount > acct.merchantLimit) {
            return _declineAuth(_authId, _merchantId, _amount, _authHash, paramsHash, DeclineReason.INSUFFICIENT_BALANCE);
        }

        if (acct.dailyLimit != 0 && acct.dailySpent + _amount > acct.dailyLimit) {
            return _declineAuth(_authId, _merchantId, _amount, _authHash, paramsHash, DeclineReason.VELOCITY_LIMIT_EXCEEDED);
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

        // TODO: can check about sending the funds here then doing a transfer/smart contract call on Rain
        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _amount
        });
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            stewardsVaultOwner,
            stewardsVaultAccountNumber,
            rainFloat,
            USDC_MARKET_ID,
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

        Require.that(
            length != 0 && length <= MAX_BATCH_SIZE,
            _FILE,
            "Invalid batch length"
        );
        Require.that(
            length == _amounts.length,
            _FILE,
            "Invalid amount length"
        );
        Require.that(
            !isBatchProcessed[_batchId],
            _FILE,
            "Batch already processed"
        );
        Require.that(
            _authParams.from != address(0),
            _FILE,
            "Invalid from address"
        );

        uint256 totalAmount;
        for (uint256 i; i < length; ++i) {
            Require.that(
                _amounts[i] == 0,
                _FILE,
                "Zero repayment amount"
            );
            if (i > 0) {
                Require.that(
                    _merchantIds[i] > _merchantIds[i - 1],
                    _FILE,
                    "Invalid batch order"
                );
            }
            totalAmount += _amounts[i];
        }

        isBatchProcessed[_batchId] = true;

        bytes32 batchDigest = calculateBatchDigest(_batchId, _merchantIds, _amounts);
        address usdcToken = DOLOMITE_MARGIN().getMarketTokenAddress(USDC_MARKET_ID);

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
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            stewardsVaultOwner,
            address(this),
            stewardsVaultAccountNumber,
            USDC_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: totalAmount
            })
        );

        _applyRepayments(_merchantIds, _amounts);

        emit BatchRepaid(_batchId, batchDigest, totalAmount, length);
    }

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    function ownerSetRelayer(address _relayer, bool _allowed) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRelayer(_relayer, _allowed);
    }

    function ownerSetRainFloat(address _rainFloat) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRainFloat(_rainFloat);
    }

    function ownerSetStewardsVault(
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetStewardsVault(_stewardsVaultOwner, _stewardsVaultAccountNumber);
    }

    function ownerConfigureMerchantAccount(
        uint256 _merchantId,
        uint256 _merchantLimit,
        uint256 _factorBps,
        uint256 _outstandingPrincipal,
        uint256 _outstandingFactor,
        uint256 _dailySpent,
        uint256 _dailyLimit,
        bool _enabled
    ) external onlyDolomiteMarginOwner(msg.sender) {
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

    function getAuthRecord(bytes32 _authId) external view override returns (AuthRecord memory) {
        return authRecords[_authId];
    }

    function getMerchantAccount(uint256 _merchantId) external view override returns (MerchantAccountState memory) {
        return merchantAccounts[_merchantId];
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

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _ownerSetRelayer(address _relayer, bool _allowed) internal {
        Require.that(
            _relayer != address(0),
            _FILE,
            "Invalid relayer"
        );

        isRelayer[_relayer] = _allowed;

        emit RelayerUpdated(_relayer, _allowed);
    }

    function _ownerSetRainFloat(address _rainFloat) internal {
        Require.that(
            _rainFloat != address(0),
            _FILE,
            "Invalid rain float"
        );

        emit RainFloatUpdated(rainFloat, _rainFloat);
        rainFloat = _rainFloat;
    }

    function _ownerSetStewardsVault(
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber
    ) internal {
        Require.that(
            _stewardsVaultOwner != address(0),
            _FILE,
            "Invalid stewards vault owner"
        );

        stewardsVaultOwner = _stewardsVaultOwner;
        stewardsVaultAccountNumber = _stewardsVaultAccountNumber;

        emit StewardsVaultUpdated(_stewardsVaultOwner, _stewardsVaultAccountNumber);
    }

    function _applyRepayments(
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts
    ) internal {
        uint256 length = _merchantIds.length;

        for (uint256 i; i < length; ++i) {
            uint256 merchantId = _merchantIds[i];
            uint256 paymentAmount = _amounts[i];
            MerchantAccountState storage acct = merchantAccounts[merchantId];

            uint256 principalPaid;
            uint256 factorPaid;

            if (acct.factorBps > 0) {
                // @follow-up Do we round in favor of principal or factor?
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
                // @follow-up What if this makes paymentAmount not equal principalPaid + factorPaid? What to do with leftover USDC
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

    function _declineAuth(
        bytes32 _authId,
        uint256 _merchantId,
        uint256 _amount,
        bytes32 _authHash,
        bytes32 _paramsHash,
        DeclineReason _reason
    ) internal returns (AuthStatus status, DeclineReason reason) {
        authRecords[_authId] = AuthRecord({
            status: AuthStatus.DECLINED,
            reason: _reason,
            merchantId: _merchantId,
            amount: _amount,
            authHash: _authHash,
            paramsHash: _paramsHash
        });

        emit AuthDeclined(_authId, _merchantId, _amount, _authHash, _reason);

        return (AuthStatus.DECLINED, _reason);
    }
}
