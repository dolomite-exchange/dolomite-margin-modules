// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @notice Mock contract for benchmarking an Immersve-style card auth flow on Arbitrum.
/// @dev This version does NOT move USDC. It simulates account availability/collateral checks
///      and emits deterministic events for approve/decline/idempotent retry paths.
contract MockImmersveAuthRouter {
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

    struct AccountState {
        uint256 availableBalance;
        uint256 collateralValue;
        uint256 debtValue;
        uint256 minCollateralRatioBps; // e.g. 12_500 = 125%
        uint256 dailySpent;
        uint256 dailyLimit;
        bool enabled;
    }

    struct AuthRecord {
        AuthStatus status;
        DeclineReason reason;
        address account;
        uint256 amount;
        bytes32 authHash;
        bytes32 paramsHash;
    }

    address public owner;

    mapping(address => bool) public isRelayer;
    mapping(address => AccountState) public accounts;
    mapping(bytes32 => AuthRecord) public authRecords;

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event RelayerUpdated(address indexed relayer, bool isRelayer);

    event AccountConfigured(
        address indexed account,
        uint256 availableBalance,
        uint256 collateralValue,
        uint256 debtValue,
        uint256 minCollateralRatioBps,
        uint256 dailySpent,
        uint256 dailyLimit,
        bool enabled
    );

    event AuthFunded(
        bytes32 indexed authId,
        address indexed account,
        uint256 amount,
        bytes32 authHash
    );

    event AuthDeclined(
        bytes32 indexed authId,
        address indexed account,
        uint256 amount,
        bytes32 authHash,
        DeclineReason reason
    );

    event AuthAlreadyResolved(
        bytes32 indexed authId,
        address indexed account,
        AuthStatus status,
        DeclineReason reason,
        uint256 amount,
        bytes32 authHash
    );

    error NotOwner();
    error NotRelayer();
    error ZeroAddress();
    error AuthReplayConflict(bytes32 authId);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
        isRelayer[_owner] = true;

        emit OwnerUpdated(address(0), _owner);
        emit RelayerUpdated(_owner, true);
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address oldOwner = owner;
        owner = newOwner;

        emit OwnerUpdated(oldOwner, newOwner);
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();

        isRelayer[relayer] = allowed;

        emit RelayerUpdated(relayer, allowed);
    }

    function configureAccount(
        address account,
        uint256 availableBalance,
        uint256 collateralValue,
        uint256 debtValue,
        uint256 minCollateralRatioBps,
        uint256 dailySpent,
        uint256 dailyLimit,
        bool enabled
    ) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();

        accounts[account] = AccountState({
            availableBalance: availableBalance,
            collateralValue: collateralValue,
            debtValue: debtValue,
            minCollateralRatioBps: minCollateralRatioBps,
            dailySpent: dailySpent,
            dailyLimit: dailyLimit,
            enabled: enabled
        });

        emit AccountConfigured(
            account,
            availableBalance,
            collateralValue,
            debtValue,
            minCollateralRatioBps,
            dailySpent,
            dailyLimit,
            enabled
        );
    }

    /// @notice Main benchmark function. This should mirror the future real auth function shape.
    /// @param authId Unique Immersve/card auth id.
    /// @param account Simulated card account.
    /// @param amount Auth amount, normally USDC 6-decimal units.
    /// @param authHash Hash of the Immersve auth payload / normalized payment context.
    function fundAuth(
        bytes32 authId,
        address account,
        uint256 amount,
        bytes32 authHash
    ) external onlyRelayer returns (AuthStatus status, DeclineReason reason) {
        bytes32 paramsHash = keccak256(abi.encode(account, amount, authHash));

        AuthRecord storage existing = authRecords[authId];

        if (existing.status != AuthStatus.NONE) {
            if (existing.paramsHash != paramsHash) {
                revert AuthReplayConflict(authId);
            }

            emit AuthAlreadyResolved(
                authId,
                existing.account,
                existing.status,
                existing.reason,
                existing.amount,
                existing.authHash
            );

            return (existing.status, existing.reason);
        }

        AccountState storage acct = accounts[account];

        reason = _getDeclineReason(acct, amount);

        if (reason != DeclineReason.NONE) {
            authRecords[authId] = AuthRecord({
                status: AuthStatus.DECLINED,
                reason: reason,
                account: account,
                amount: amount,
                authHash: authHash,
                paramsHash: paramsHash
            });

            emit AuthDeclined(authId, account, amount, authHash, reason);

            return (AuthStatus.DECLINED, reason);
        }

        // Simulate the accounting effect of moving funds into the Immersve float.
        acct.availableBalance -= amount;
        acct.dailySpent += amount;

        authRecords[authId] = AuthRecord({
            status: AuthStatus.FUNDED,
            reason: DeclineReason.NONE,
            account: account,
            amount: amount,
            authHash: authHash,
            paramsHash: paramsHash
        });

        emit AuthFunded(authId, account, amount, authHash);

        return (AuthStatus.FUNDED, DeclineReason.NONE);
    }

    function getAuthRecord(bytes32 authId) external view returns (AuthRecord memory) {
        return authRecords[authId];
    }

    function getAccount(address account) external view returns (AccountState memory) {
        return accounts[account];
    }

    function _getDeclineReason(
        AccountState storage acct,
        uint256 amount
    ) internal view returns (DeclineReason) {
        if (!acct.enabled) {
            return DeclineReason.ACCOUNT_DISABLED;
        }

        if (amount > acct.availableBalance) {
            return DeclineReason.INSUFFICIENT_BALANCE;
        }

        if (acct.dailyLimit != 0 && acct.dailySpent + amount > acct.dailyLimit) {
            return DeclineReason.VELOCITY_LIMIT_EXCEEDED;
        }

        // If there is no debt, treat collateralization as OK.
        // Otherwise require collateralValue / debtValue >= minCollateralRatioBps.
        if (acct.debtValue != 0) {
            uint256 lhs = acct.collateralValue * 10_000;
            uint256 rhs = acct.debtValue * acct.minCollateralRatioBps;

            if (lhs < rhs) {
                return DeclineReason.INSUFFICIENT_COLLATERAL;
            }
        }

        return DeclineReason.NONE;
    }
}
