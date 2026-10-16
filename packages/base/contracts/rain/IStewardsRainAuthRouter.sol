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

import { IRouterBase } from "../routers/interfaces/IRouterBase.sol";


/**
 * @title   IStewardsRainAuthRouter
 * @author  Dolomite
 *
 * @notice  Interface for the Stewards Rain Auth Router handling card transaction authorizations
 *          funded via Dolomite Margin borrows and batched merchant repayments.
 */
interface IStewardsRainAuthRouter is IRouterBase {

    enum AuthStatus {
        NONE,
        FUNDED,
        DECLINED
    }

    enum DeclineReason {
        NONE,
        INSUFFICIENT_BALANCE,
        INSUFFICIENT_COLLATERAL,
        ACCOUNT_DISABLED,
        VELOCITY_LIMIT_EXCEEDED
    }

    struct MerchantAccountState {
        uint256 merchantLimit;
        uint256 factorBps; // e.g. 13_000 = 1.30x (10_000 = 1.00x)
        uint256 outstandingPrincipal;
        uint256 outstandingFactor;
        uint256 dailySpent;
        uint256 dailyLimit;
        bool enabled;
    }

    struct RepaymentAuthParams {
        address from;
        uint256 validAfter;
        uint256 validBefore;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct AuthRecord {
        AuthStatus status;
        DeclineReason reason;
        uint256 merchantId;
        uint256 amount;
        bytes32 authHash;
        bytes32 paramsHash;
    }

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event RelayerUpdated(address indexed relayer, bool isRelayer);
    event RainFloatUpdated(address oldFloat, address newFloat);
    event StewardsVaultUpdated(address vaultOwner, uint256 vaultAccountNumber, uint256 usdcMarketId);

    event MerchantConfigured(
        uint256 indexed merchantId,
        uint256 merchantLimit,
        uint256 factorBps,
        uint256 outstandingPrincipal,
        uint256 outstandingFactor,
        uint256 dailySpent,
        uint256 dailyLimit,
        bool enabled
    );

    event AuthFunded(
        bytes32 indexed authId,
        uint256 indexed merchantId,
        uint256 amount,
        bytes32 authHash
    );

    event AuthDeclined(
        bytes32 indexed authId,
        uint256 indexed merchantId,
        uint256 amount,
        bytes32 authHash,
        DeclineReason reason
    );

    event AuthAlreadyResolved(
        bytes32 indexed authId,
        uint256 indexed merchantId,
        AuthStatus status,
        DeclineReason reason,
        uint256 amount,
        bytes32 authHash
    );

    event MerchantRepaid(
        uint256 indexed merchantId,
        uint256 repaymentAmount,
        uint256 principalPaid,
        uint256 factorPaid,
        uint256 remainingPrincipal,
        uint256 remainingFactor
    );

    event BatchRepaid(
        uint256 indexed batchId,
        bytes32 indexed batchDigest,
        uint256 totalAmount,
        uint256 merchantCount
    );

    // ========================================================
    // ======================== Errors ========================
    // ========================================================

    error NotOwner();
    error NotRelayer();
    error ZeroAddress();
    error InvalidBatchSize();
    error InvalidBatchOrder();
    error BatchAlreadyProcessed(uint256 batchId);
    error InvalidRepaymentAmount();
    error AuthReplayConflict(bytes32 authId);
    error InvalidFactor();
    error ArrayLengthMismatch();

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function initialize(
        address _owner,
        address _rainFloat,
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber,
        uint256 _usdcMarketId
    ) external;

    function setOwner(address _newOwner) external;

    function setRelayer(address _relayer, bool _allowed) external;

    function setRainFloat(address _rainFloat) external;

    function setStewardsVault(
        address _stewardsVaultOwner,
        uint256 _stewardsVaultAccountNumber,
        uint256 _usdcMarketId
    ) external;

    function configureMerchantAccount(
        uint256 _merchantId,
        uint256 _merchantLimit,
        uint256 _factorBps,
        uint256 _outstandingPrincipal,
        uint256 _outstandingFactor,
        uint256 _dailySpent,
        uint256 _dailyLimit,
        bool _enabled
    ) external;

    function fundAuth(
        bytes32 _authId,
        uint256 _merchantId,
        uint256 _amount,
        bytes32 _authHash
    ) external returns (AuthStatus status, DeclineReason reason);

    function repayBatch(
        uint256 _batchId,
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts,
        RepaymentAuthParams calldata _authParams
    ) external;

    function calculateBatchDigest(
        uint256 _batchId,
        uint256[] calldata _merchantIds,
        uint256[] calldata _amounts
    ) external view returns (bytes32);

    function getAuthRecord(bytes32 _authId) external view returns (AuthRecord memory);

    function getMerchantAccount(uint256 _merchantId) external view returns (MerchantAccountState memory);

    function isRelayer(address _relayer) external view returns (bool);

    function isBatchProcessed(uint256 _batchId) external view returns (bool);

    function owner() external view returns (address);

    function rainFloat() external view returns (address);

    function stewardsVaultOwner() external view returns (address);

    function stewardsVaultAccountNumber() external view returns (uint256);

    function usdcMarketId() external view returns (uint256);
}
