// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { IBorrowPositionProxyV2 } from "../../interfaces/IBorrowPositionProxyV2.sol";
import { IWrappedTokenUserVaultFactory } from "../../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../../interfaces/IWrappedTokenUserVaultV1.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   WrappedTokenUserVaultV1
 * @author  Dolomite
 *
 * @notice  Abstract implementation (for an upgradeable proxy) for wrapping tokens via a per-user vault that can be used
 *          with DolomiteMargin
 */
abstract contract WrappedTokenUserVaultV1 is IWrappedTokenUserVaultV1 {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteMargin.Par;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "WrappedTokenUserVaultV1";
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // =================================================
    // ================ Field Variables ================
    // =================================================

    uint256 private _reentrancyGuard;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyVaultFactory(address _from) {
        Require.that(
            _from == address(VAULT_FACTORY()),
            _FILE,
            "Only factory can call",
            _from
        );
        _;
    }

    modifier onlyVaultOwner(address _from) {
        Require.that(
            _from == _proxySelf().owner(),
            _FILE,
            "Only owner can call",
            _from
        );
        _;
    }

    modifier onlyVaultOwnerOrVaultFactory(address _from) {
        Require.that(
            _from == address(_proxySelf().owner()) || _from == VAULT_FACTORY(),
            _FILE,
            "Only owner or factory can call",
            _from
        );
        _;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly. Calling a `nonReentrant` function from
     *      another `nonReentrant` function is not supported. It is possible to prevent this from happening by making
     *      the `nonReentrant` function external, and making it call a `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _reentrancyGuard will be _NOT_ENTERED
        Require.that(
            _reentrancyGuard != _ENTERED,
            _FILE,
            "Reentrant call"
        );

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuard = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuard = _NOT_ENTERED;
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function initialize() external {
        Require.that(
            _reentrancyGuard == 0,
            _FILE,
            "Already initialized"
        );

        _reentrancyGuard = _NOT_ENTERED;
    }

    function depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        // This implementation requires we deposit into index 0
        Require.that(
            _toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );
        IWrappedTokenUserVaultFactory(VAULT_FACTORY()).depositIntoDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        // This implementation requires we withdraw from index 0
        Require.that(
            _fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        IWrappedTokenUserVaultFactory(VAULT_FACTORY()).withdrawFromDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        Require.that(
            _toAccountNumber != 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        BORROW_POSITION_PROXY().openBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this),
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this),
            _toAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        Require.that(
            _toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        uint256[] memory collateralMarketIds = new uint256[](1);
        collateralMarketIds[0] = marketId();

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this),
            _toAccountNumber,
            collateralMarketIds
        );
    }

    function closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    external
    onlyVaultOwner(msg.sender) {
        uint256 underlyingMarketId = marketId();
        for (uint256 i = 0; i < _collateralMarketIds.length; i++) {
            Require.that(
                _collateralMarketIds[i] != underlyingMarketId,
                _FILE,
                "Cannot withdraw market to wallet",
                underlyingMarketId
            );
        }

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender,
            _toAccountNumber,
            _collateralMarketIds
        );
    }

    function transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        Require.that(
            _borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this),
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this),
            _borrowAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender,
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this),
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        _checkAllowableCollateralMarket(address(this), _borrowAccountNumber, _marketId);
    }

    function transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        Require.that(
            _toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this),
            _toAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    virtual
    onlyVaultOwner(msg.sender) {
        _transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    onlyVaultOwner(msg.sender) {
        Require.that(
            _marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );
        BORROW_POSITION_PROXY().repayAllForBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender,
            _fromAccountNumber,
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    // ======== Public functions ========

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    virtual
    onlyVaultFactory(msg.sender) {
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    virtual
    onlyVaultFactory(msg.sender) {
        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function UNDERLYING_TOKEN() public view returns (address) {
        return IWrappedTokenUserVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
    }

    function DOLOMITE_MARGIN() public view returns (IDolomiteMargin) {
        return IWrappedTokenUserVaultFactory(VAULT_FACTORY()).DOLOMITE_MARGIN();
    }

    function BORROW_POSITION_PROXY() public view returns (IBorrowPositionProxyV2) {
        return IWrappedTokenUserVaultFactory(VAULT_FACTORY()).BORROW_POSITION_PROXY();
    }

    function VAULT_FACTORY() public virtual view returns (address) {
        return _proxySelf().vaultFactory();
    }

    function marketId() public view returns (uint256) {
        return IWrappedTokenUserVaultFactory(VAULT_FACTORY()).marketId();
    }

    function underlyingBalanceOf() public override virtual view returns (uint256) {
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(this));
    }

    // ============ Internal Functions ============

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        Require.that(
            _marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
        /* _fromAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        _checkAllowableDebtMarket(address(this), _borrowAccountNumber, _marketId);
    }

    function _checkAllowableCollateralMarket(
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) internal view {
        // If the balance is positive, check that the collateral is for an allowable market. We use the Par balance
        // because, it uses less gas than getting the Wei balance, and we're only checking whether the balance is
        // positive.
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isPositive()) {
            // Check the allowable collateral markets for the position:
            IWrappedTokenUserVaultFactory vaultFactory = IWrappedTokenUserVaultFactory(VAULT_FACTORY());
            uint256[] memory allowableCollateralMarketIds = vaultFactory.allowableCollateralMarketIds();
            if (allowableCollateralMarketIds.length != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableCollateralMarketIds.length; i++) {
                    if (allowableCollateralMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as collateral",
                    _marketId
                );
            }
        }
    }

    function _proxySelf() internal view returns (IWrappedTokenUserVaultProxy) {
        return IWrappedTokenUserVaultProxy(address(this));
    }

    function _checkAllowableDebtMarket(
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) internal view {
        // If the balance is negative, check that the debt is for an allowable market. We use the Par balance because,
        // it uses less gas than getting the Wei balance, and we're only checking whether the balance is negative.
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isNegative()) {
            // Check the allowable debt markets for the position:
            IWrappedTokenUserVaultFactory vaultFactory = IWrappedTokenUserVaultFactory(VAULT_FACTORY());
            uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
            if (allowableDebtMarketIds.length != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableDebtMarketIds.length; i++) {
                    if (allowableDebtMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as debt",
                    _marketId
                );
            }
        }
    }
}
