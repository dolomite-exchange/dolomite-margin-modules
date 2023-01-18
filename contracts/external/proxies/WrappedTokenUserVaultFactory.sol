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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IBorrowPositionProxyV2 } from "../interfaces/IBorrowPositionProxyV2.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { WrappedTokenUserVaultProxy } from "./WrappedTokenUserVaultProxy.sol";


/**
 * @title WrappedTokenUserVaultFactory
 * @author Dolomite
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

    // =================================================
    // ==================== Structs ====================
    // =================================================

    struct QueuedTransfer {
        address from;
        address to;
        uint256 amount;
        address vault;
    }

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "WrappedTokenUserVaultFactory";

    // ==================================================
    // ================ Immutable Fields ================
    // ==================================================

    address public immutable override UNDERLYING_TOKEN; // solhint-disable-line var-name-mixedcase
    IBorrowPositionProxyV2 public immutable override BORROW_POSITION_PROXY; // solhint-disable-line var-name-mixedcase

    // ================================================
    // ==================== Fields ====================
    // ================================================

    address public override userVaultImplementation;
    bool public isInitialized;
    uint256 public override marketId; // can't be immutable because it's set in the call to #initialize
    uint256 public transferCursor;
    mapping(uint256 => QueuedTransfer) public cursorToQueuedTransferMap;
    mapping(address => address) public vaultToUserMap;
    mapping(address => address) public userToVaultMap;
    mapping(address => bool) public tokenUnwrapperMap;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireIsInitialized {
        Require.that(isInitialized, _FILE, "Not initialized");
        _;
    }

    modifier requireIsVault(address _vault) {
        Require.that(address(vaultToUserMap[_vault]) != address(0), _FILE, "Caller is not a vault");
        _;
    }

    modifier requireCursorIsNotQueued {
        Require.that(
            cursorToQueuedTransferMap[transferCursor].from == address(0),
            _FILE,
            "Transfer is already queued"
        );
        _;
    }

    modifier onlyOwner {
        Require.that(
            msg.sender == DOLOMITE_MARGIN.owner(),
            _FILE,
            "Caller is not the owner"
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

    function initialize(address[] calldata _tokenUnwrappers) external override {
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

        for (uint256 i = 0; i < _tokenUnwrappers.length; i++) {
            _setIsTokenUnwrapperTrusted(_tokenUnwrappers[i], true);
        }

        isInitialized = true;
    }

    function createVault(address _account) external override returns (address) {
        return _createVault(_account);
    }

    function createVaultAndDepositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external override returns (address) {
        address vault = _createVault(msg.sender);
        IWrappedTokenUserVaultV1(vault).depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
        return vault;
    }

    function setUserVaultImplementation(address _userVaultImplementation) external override onlyOwner {
        emit UserVaultImplementationSet(userVaultImplementation, _userVaultImplementation);
        userVaultImplementation = _userVaultImplementation;
    }

    function setIsTokenUnwrapperTrusted(address _tokenUnwrapper, bool _isTrusted) external override onlyOwner {
        _setIsTokenUnwrapperTrusted(_tokenUnwrapper, _isTrusted);
    }

    function depositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    override
    requireIsVault(msg.sender)
    requireIsInitialized
    requireCursorIsNotQueued {
        cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: msg.sender,
            to: address(DOLOMITE_MARGIN),
            amount: _amountWei,
            vault: msg.sender
        });
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ msg.sender, // solium-disable-line indentation
            _toAccountNumber,
            marketId,
            IDolomiteMargin.AssetAmount({
                sign: true,
                denomination: IDolomiteMargin.AssetDenomination.Wei,
                ref: IDolomiteMargin.AssetReference.Delta,
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
    requireIsVault(msg.sender)
    requireIsInitialized
    requireCursorIsNotQueued {
        cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: address(DOLOMITE_MARGIN),
            to: msg.sender,
            amount: _amountWei,
            vault: msg.sender
        });
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            marketId,
            IDolomiteMargin.AssetAmount({
                sign: true,
                denomination: IDolomiteMargin.AssetDenomination.Wei,
                ref: IDolomiteMargin.AssetReference.Delta,
                value: _amountWei
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );
    }

    function liquidateWithinDolomiteMargin(
        address _recipient,
        uint256 _amountWei
    )
    external
    override
    requireIsVault(msg.sender)
    requireIsInitialized
    requireCursorIsNotQueued {
        Require.that(
            tokenUnwrapperMap[_recipient],
            _FILE,
            "Invalid liquidation recipient"
        );
        cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: address(DOLOMITE_MARGIN),
            to: _recipient,
            amount: _amountWei,
            vault: msg.sender
        });
    }

    // ================================================
    // ================ Read Functions ================
    // ================================================

    function name() external override virtual view returns (string memory) {
        return string(abi.encodePacked("Dolomite: ", ERC20(UNDERLYING_TOKEN).name()));
    }

    function symbol() external override virtual view returns (string memory) {
        return string(abi.encodePacked("d", ERC20(UNDERLYING_TOKEN).symbol()));
    }

    function decimals() external override virtual view returns (uint8) {
        return ERC20(UNDERLYING_TOKEN).decimals();
    }

    function isTokenUnwrapperTrusted(address _tokenUnwrapper) external override view returns (bool) {
        return tokenUnwrapperMap[_tokenUnwrapper];
    }

    function getVaultByAccount(address _account) external override view returns (address _vault) {
        _vault = userToVaultMap[_account];
    }

    function calculateVaultByAccount(address _account) external override view returns (address _vault) {
        _vault = Create2.computeAddress(
            keccak256(abi.encodePacked(_account)),
            keccak256(type(WrappedTokenUserVaultProxy).creationCode)
        );
    }

    function getAccountByVault(address _vault) external override view returns (address _account) {
        _account = vaultToUserMap[_vault];
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _setIsTokenUnwrapperTrusted(address _tokenUnwrapper, bool _isTrusted) internal {
        tokenUnwrapperMap[_tokenUnwrapper] = _isTrusted;
        emit TokenUnwrapperSet(_tokenUnwrapper, _isTrusted);
    }

    function _createVault(address _account) internal returns (address) {
        Require.that(
            userToVaultMap[_account] == address(0),
            _FILE,
            "Vault already exists"
        );
        address vault = Create2.deploy(
            /* amount = */ 0, // solium-disable-line indentation
            keccak256(abi.encodePacked(_account)),
            type(WrappedTokenUserVaultProxy).creationCode
        );
        vaultToUserMap[vault] = _account;
        userToVaultMap[_account] = vault;
        IWrappedTokenUserVaultProxy(vault).initialize(_account);
        BORROW_POSITION_PROXY.setIsCallerAuthorized(vault, true);
        return vault;
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

        QueuedTransfer memory queuedTransfer = cursorToQueuedTransferMap[transferCursor++];
        Require.that(
            queuedTransfer.from == _from
                && queuedTransfer.to == _to
                && queuedTransfer.amount == _amount
                && vaultToUserMap[queuedTransfer.vault] != address(0),
            _FILE,
            "Invalid queued transfer"
        );

        if (_to == dolomiteMargin) {
            // transfers TO DolomiteMargin must be made FROM a vault
            Require.that(
                vaultToUserMap[_from] != address(0),
                _FILE,
                "Invalid from"
            );
            IWrappedTokenUserVaultV1(queuedTransfer.vault).executeDepositIntoVault(_amount);
            _mint(_to, _amount);
        } else {
            assert(_from == dolomiteMargin);

            // transfers FROM DolomiteMargin must be made TO a vault OR to a tokenUnwrapper
            Require.that(
                vaultToUserMap[_to] != address(0) || tokenUnwrapperMap[_to],
                _FILE,
                "Invalid to"
            );

            IWrappedTokenUserVaultV1(queuedTransfer.vault).executeWithdrawalFromVault(_to, _amount);
            _burn(_from, _amount);
        }
        emit Transfer(_from, _to, _amount);
    }
}
