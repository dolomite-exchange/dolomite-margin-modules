// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";

import { Require } from "../../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../../helpers/OnlyDolomiteMargin.sol";

import { IBorrowPositionProxyV2 } from "../../interfaces/IBorrowPositionProxyV2.sol";
import { IWrappedTokenUserVaultFactory } from "../../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";

import { WrappedTokenUserVaultUpgradeableProxy } from "./WrappedTokenUserVaultUpgradeableProxy.sol";


/**
 * @title   WrappedTokenUserVaultFactory
 * @author  Dolomite
 *
 * @notice  Abstract contract for wrapping tokens via a per-user vault that credits a user's balance within
 *          DolomiteMargin
 */
abstract contract WrappedTokenUserVaultFactory is
    IWrappedTokenUserVaultFactory,
    OnlyDolomiteMargin,
    ReentrancyGuard,
    ERC20
{

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "WrappedTokenUserVaultFactory";

    // ==================================================
    // ================ Immutable Fields ================
    // ==================================================

    uint256 public constant override NONE = type(uint256).max;
    address public immutable override UNDERLYING_TOKEN; // solhint-disable-line var-name-mixedcase
    IBorrowPositionProxyV2 public immutable override BORROW_POSITION_PROXY; // solhint-disable-line var-name-mixedcase

    // ================================================
    // ==================== Fields ====================
    // ================================================

    address public override userVaultImplementation;
    bool public isInitialized;
    uint256 public override marketId; // can't be immutable because it's set in the call to #initialize
    uint256 public transferCursor;

    mapping(uint256 => QueuedTransfer) internal _cursorToQueuedTransferMap;
    mapping(address => address) internal _vaultToUserMap;
    mapping(address => address) internal _userToVaultMap;
    mapping(address => bool) internal _tokenConverterToIsTrustedMap;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireIsInitialized {
        Require.that(isInitialized, _FILE, "Not initialized");
        _;
    }

    modifier requireIsVault(address _vault) {
        Require.that(
            address(_vaultToUserMap[_vault]) != address(0),
            _FILE,
            "Invalid vault",
            _vault
        );
        _;
    }

    modifier requireIsTokenConverter(address _tokenConverter) {
        Require.that(
            _tokenConverterToIsTrustedMap[_tokenConverter],
            _FILE,
            "Caller is not a token converter",
            _tokenConverter
        );
        _;
    }

    constructor(
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    ERC20(
        /* name_ = */ string(abi.encodePacked("Dolomite: ", ERC20(_underlyingToken).name())),
        /* symbol_ = */ string(abi.encodePacked("d", ERC20(_underlyingToken).symbol()))
    )
    OnlyDolomiteMargin(_dolomiteMargin)
    {
        UNDERLYING_TOKEN = _underlyingToken;
        BORROW_POSITION_PROXY = IBorrowPositionProxyV2(_borrowPositionProxy);
        userVaultImplementation = _userVaultImplementation;
    }

    // =================================================
    // ================ Write Functions ================
    // =================================================

    function initialize(
        address[] calldata _tokenConverters
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            !isInitialized,
            _FILE,
            "Already initialized"
        );
        marketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(address(this));
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(marketId),
            _FILE,
            "Market cannot allow borrowing"
        );

        for (uint256 i = 0; i < _tokenConverters.length; i++) {
            _setIsTokenConverterTrusted(_tokenConverters[i], true);
        }

        isInitialized = true;
        emit Initialized();
    }

    function createVault(
        address _account
    )
    external
    override
    requireIsInitialized
    returns (address) {
        return _createVault(_account);
    }

    function createVaultAndDepositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    override
    requireIsInitialized
    returns (address) {
        address vault = _createVault(msg.sender);
        IWrappedTokenUserVaultV1(vault).depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
        return vault;
    }

    function setUserVaultImplementation(
        address _userVaultImplementation
    )
    external
    override
    requireIsInitialized
    onlyDolomiteMarginOwner(msg.sender) {
        emit UserVaultImplementationSet(userVaultImplementation, _userVaultImplementation);
        userVaultImplementation = _userVaultImplementation;
    }

    function setIsTokenConverterTrusted(
        address _tokenConverter,
        bool _isTrusted
    )
    external
    override
    requireIsInitialized
    onlyDolomiteMarginOwner(msg.sender) {
        _setIsTokenConverterTrusted(_tokenConverter, _isTrusted);
    }

    function depositOtherTokenIntoDolomiteMarginForVaultOwner(
        uint256 _toAccountNumber,
        uint256 _otherMarketId,
        uint256 _amountWei
    )
    external
    override
    requireIsVault(msg.sender) {
        Require.that(
            _otherMarketId != marketId,
            _FILE,
            "Invalid market",
            _otherMarketId
        );

        // we have to deposit into the vault first and then transfer to vault.owner, because the deposit is not
        // coming from the factory address or the vault owner.
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
        accounts[0] = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: 0
        });
        accounts[1] = IDolomiteStructs.AccountInfo({
            owner: _vaultToUserMap[msg.sender],
            number: _toAccountNumber
        });

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](2);
        actions[0] = AccountActionLib.encodeDepositAction(
            /* _accountId = */ 0,
            _otherMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            /* _fromAccount = */ msg.sender
        );
        actions[1] = AccountActionLib.encodeTransferAction(
            /* _fromAccountId = */ 0,
            /* _toAccountId = */ 1,
            _otherMarketId,
            AccountActionLib.all()
        );

        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    function enqueueTransferIntoDolomiteMargin(
        address _vault,
        uint256 _amountWei
    )
    external
    override
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _enqueueTransfer(msg.sender, address(DOLOMITE_MARGIN), _amountWei, _vault);
    }

    function enqueueTransferFromDolomiteMargin(
        address _vault,
        uint256 _amountWei
    )
    external
    override
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _enqueueTransfer(address(DOLOMITE_MARGIN), msg.sender, _amountWei, _vault);
    }

    function depositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    override
    requireIsVault(msg.sender) {
        address vault = msg.sender;
        _enqueueTransfer(
            vault,
            address(DOLOMITE_MARGIN),
            _amountWei,
            vault
        );
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ vault,
            /* _fromAccount = */ vault,
            _toAccountNumber,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
    }

    function withdrawFromDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external
    override
    requireIsVault(msg.sender) {
        address vault = msg.sender;
        _enqueueTransfer(
            address(DOLOMITE_MARGIN),
            vault,
            _amountWei,
            vault
        );
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ vault,
            _fromAccountNumber,
            /* _toAccount = */ vault,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );
    }

    // ================================================
    // ================ Read Functions ================
    // ================================================

    function getQueuedTransferByCursor(uint256 _transferCursor) external view returns (QueuedTransfer memory) {
        Require.that(
            _transferCursor <= transferCursor,
            _FILE,
            "Invalid transfer cursor"
        );
        return _cursorToQueuedTransferMap[_transferCursor];
    }

    function isTokenConverterTrusted(address _tokenConverter) external override view returns (bool) {
        return _tokenConverterToIsTrustedMap[_tokenConverter];
    }

    function getVaultByAccount(address _account) external override view returns (address _vault) {
        _vault = _userToVaultMap[_account];
    }

    function calculateVaultByAccount(address _account) external override view returns (address _vault) {
        _vault = Create2.computeAddress(
            keccak256(abi.encodePacked(_account)),
            keccak256(type(WrappedTokenUserVaultUpgradeableProxy).creationCode)
        );
    }

    function getAccountByVault(address _vault) external override view returns (address _account) {
        _account = _vaultToUserMap[_vault];
    }

    function isIsolationAsset() external pure returns (bool) {
        return true;
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _setIsTokenConverterTrusted(address _tokenConverter, bool _isTrusted) internal {
        _tokenConverterToIsTrustedMap[_tokenConverter] = _isTrusted;
        emit TokenConverterSet(_tokenConverter, _isTrusted);
    }

    function _createVault(address _account) internal returns (address) {
        Require.that(
            _userToVaultMap[_account] == address(0),
            _FILE,
            "Vault already exists"
        );
        address vault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(WrappedTokenUserVaultUpgradeableProxy).creationCode
        );
        emit VaultCreated(_account, vault);
        _vaultToUserMap[vault] = _account;
        _userToVaultMap[_account] = vault;
        IWrappedTokenUserVaultProxy(vault).initialize(_account);
        BORROW_POSITION_PROXY.setIsCallerAuthorized(vault, true);
        return vault;
    }

    function _enqueueTransfer(
        address _from,
        address _to,
        uint256 _amount,
        address _vault
    ) internal {
        QueuedTransfer memory oldTransfer = _cursorToQueuedTransferMap[transferCursor];
        if (!oldTransfer.isExecuted && oldTransfer.to == address(DOLOMITE_MARGIN)) {
            // remove the approval if the previous transfer was not executed and was to DolomiteMargin
            _approve(oldTransfer.vault, oldTransfer.to, 0);
        }

        if (_to == address(DOLOMITE_MARGIN)) {
            // Approve the queued transfer amount from the vault contract into DolomiteMargin from this contract
            _approve(_vault, _to, _amount);
        }
        // add 1 to the cursor for any enqueue, allowing anyone to overwrite stale enqueues in case a developer
        // doesn't integrate with this contract properly
        transferCursor += 1;
        _cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: _from,
            to: _to,
            amount: _amount,
            vault: _vault,
            isExecuted: false
        });
        emit TransferQueued(transferCursor, _from, _to, _amount, _vault);
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    )
    internal
    override
    onlyDolomiteMargin(msg.sender) {
        Require.that(
            _from != address(0),
            _FILE,
            "Transfer from the zero address"
        );
        Require.that(
            _to != address(0),
            _FILE,
            "Transfer to the zero address"
        );

        // Since this must be called from DolomiteMargin via Exchange#transferIn/Exchange#transferOut, we can assume
        // that it's non-reentrant
        address dolomiteMargin = address(DOLOMITE_MARGIN);
        Require.that(
            _from == dolomiteMargin || _to == dolomiteMargin,
            _FILE,
            "from/to must eq DolomiteMargin"
        );

        uint _transferCursor = transferCursor;
        QueuedTransfer memory queuedTransfer = _cursorToQueuedTransferMap[_transferCursor];
        Require.that(
            queuedTransfer.from == _from
                && queuedTransfer.to == _to
                && queuedTransfer.amount == _amount
                && _vaultToUserMap[queuedTransfer.vault] != address(0),
            _FILE,
            "Invalid queued transfer"
        );
        Require.that(
            !queuedTransfer.isExecuted,
            _FILE,
            "Transfer already executed",
            _transferCursor
        );
        _cursorToQueuedTransferMap[_transferCursor].isExecuted = true;

        if (_to == dolomiteMargin) {
            // transfers TO DolomiteMargin must be made FROM a vault or a tokenConverter
            address vaultOwner = _vaultToUserMap[_from];
            Require.that(
                (vaultOwner != address(0) && _from == queuedTransfer.vault) || _tokenConverterToIsTrustedMap[_from],
                _FILE,
                "Invalid from"
            );
            IWrappedTokenUserVaultV1(queuedTransfer.vault).executeDepositIntoVault(
                vaultOwner != address(0) ? vaultOwner : _from,
                _amount
            );
            _mint(_to, _amount);
        } else {
            assert(_from == dolomiteMargin);

            // transfers FROM DolomiteMargin must be made TO a vault OR to a tokenConverter
            address vaultOwner = _vaultToUserMap[_to];
            Require.that(
                vaultOwner != address(0) || _tokenConverterToIsTrustedMap[_to],
                _FILE,
                "Invalid to"
            );

            IWrappedTokenUserVaultV1(queuedTransfer.vault).executeWithdrawalFromVault(
                vaultOwner != address(0) ? vaultOwner : _to,
                _amount
            );
            _burn(_from, _amount);
        }
        emit Transfer(_from, _to, _amount);
    }
}