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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginCallee } from "../../protocol/interfaces/IDolomiteMarginCallee.sol";
import { IDolomiteMarginLiquidationCallback } from "../../protocol/interfaces/IDolomiteMarginLiquidationCallback.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IBorrowPositionProxyV2 } from "../interfaces/IBorrowPositionProxyV2.sol";
import { IGLPRewardRouterV2 } from"../interfaces/IGLPRewardRouterV2.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   GLPWrappedTokenUserVault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPWrappedTokenUserVault is
    IWrappedTokenUserVaultV1,
    IDolomiteMarginCallee,
    IDolomiteMarginLiquidationCallback
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrappedTokenUserVault";

    // ============ Field Variables ============

    uint256 public transferCursor;
    mapping(uint256 => uint256) public cursorToQueuedTransferAmountMap;

    // ============ Modifiers ============

    modifier onlyDolomiteMargin(address _from) {
        Require.that(
            _from == address(DOLOMITE_MARGIN()),
            _FILE,
            "Only Dolomite can call function",
            _from
        );
        _;
    }

    modifier onlyVaultFactory(address _from) {
        Require.that(
            _from == address(VAULT_FACTORY()),
            _FILE,
            "Only factory can call function",
            _from
        );
        _;
    }

    modifier onlyVaultOwner(address _from) {
        Require.that(
            _from == address(_proxySelf().owner()),
            _FILE,
            "Only owner can call function",
            _from
        );
        _;
    }

    modifier onlyVaultOwnerOrVaultFactory(address _from) {
        Require.that(
            _from == address(_proxySelf().owner()) || _from == address(VAULT_FACTORY()),
            _FILE,
            "Only owner or factory can call",
            _from
        );
        _;
    }

    // ============ External Functions ============

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
        VAULT_FACTORY().depositIntoDolomiteMargin(_toAccountNumber, _amountWei);
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
        VAULT_FACTORY().withdrawFromDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    )
    external
    onlyVaultOwner(msg.sender) {
        GLP_REWARDS_ROUTER().handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldConvertWethToEth
        );
    }

    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        BORROW_POSITION_PROXY().openBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this), // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            MARKET_ID(),
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
        uint256[] memory collateralMarketIds = new uint256[](1);
        collateralMarketIds[0] = MARKET_ID();

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this), // solium-disable-line indentation
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
        uint256 sGLPMarketId = MARKET_ID();
        for (uint256 i = 0; i < _collateralMarketIds.length; i++) {
            Require.that(
                _collateralMarketIds[i] != sGLPMarketId,
                _FILE,
                "Cannot withdraw sGLP to wallet"
            );
        }

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender, // solium-disable-line indentation
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
        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this), // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            MARKET_ID(),
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
            _marketId != MARKET_ID(),
            _FILE,
            "Invalid marketId"
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            MARKET_ID(),
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
    onlyVaultOwner(msg.sender) {
        Require.that(
            _marketId != MARKET_ID(),
            _FILE,
            "Invalid marketId"
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this), // solium-disable-line indentation
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender, // solium-disable-line indentation
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
            _marketId != MARKET_ID(),
            _FILE,
            "Invalid marketId"
        );
        BORROW_POSITION_PROXY().repayAllForBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    function executeDepositIntoVault(uint256 _amount) external onlyVaultFactory(msg.sender) {
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_proxySelf().owner(), address(this), _amount);
    }

    function executeWithdrawalFromVault(address _recipient, uint256 _amount) external onlyVaultFactory(msg.sender) {
        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function onLiquidate(
        uint256,
        uint256 _heldMarketId,
        IDolomiteMargin.Wei calldata _heldDeltaWei,
        uint256,
        IDolomiteMargin.Wei calldata
    )
    external
    onlyDolomiteMargin(msg.sender) {
        if (_heldMarketId == MARKET_ID()) {
            Require.that(
                cursorToQueuedTransferAmountMap[transferCursor] == 0,
                _FILE,
                "A transfer is already queued"
            );
            cursorToQueuedTransferAmountMap[transferCursor] = _heldDeltaWei.value;
        }
    }

    function callFunction(
        address,
        IDolomiteMargin.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    onlyDolomiteMargin(msg.sender) {
        Require.that(
            _accountInfo.owner == address(this),
            _FILE,
            "Invalid account owner",
            _accountInfo.owner
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        Require.that(
            dolomiteMargin.getAccountStatus(_accountInfo) == IDolomiteMargin.AccountStatus.Liquid,
            _FILE,
            "Account not liquid"
        );

        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        IERC20 token = IERC20(UNDERLYING_TOKEN());
        (address recipient) = abi.decode(_data, (address));
        Require.that(
            recipient != address(0),
            _FILE,
            "Invalid recipient"
        );

        uint256 transferAmount = cursorToQueuedTransferAmountMap[transferCursor++];
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer"
        );

        IDolomiteMargin.Wei memory accountWei = dolomiteMargin.getAccountWei(_accountInfo, MARKET_ID());
        Require.that(
            token.balanceOf(address(this)) >= transferAmount + accountWei.value,
            _FILE,
            "Insufficient balance"
        );
        assert(accountWei.sign);

        // notify the vault factory of the liquidation, so the tokens can be transferred on the call to #exchange.
        VAULT_FACTORY().liquidateWithinDolomiteMargin(recipient, transferAmount);
    }

    // ======== Public functions ========

    function UNDERLYING_TOKEN() public view returns (address) {
        return VAULT_FACTORY().UNDERLYING_TOKEN();
    }

    function MARKET_ID() public view returns (uint256) {
        return VAULT_FACTORY().MARKET_ID();
    }

    function DOLOMITE_MARGIN() public view returns (IDolomiteMargin) {
        return VAULT_FACTORY().DOLOMITE_MARGIN();
    }

    function BORROW_POSITION_PROXY() public view returns (IBorrowPositionProxyV2) {
        return VAULT_FACTORY().BORROW_POSITION_PROXY();
    }

    function GLP_REWARDS_ROUTER() public view returns (IGLPRewardRouterV2) {
        return VAULT_FACTORY().glpRewardsRouter();
    }

    function VAULT_FACTORY() public view returns (IGLPWrappedTokenUserVaultFactory) {
        return IGLPWrappedTokenUserVaultFactory(_proxySelf().vaultFactory());
    }

    // ============ Internal Functions ============

    function _proxySelf() internal view returns (IWrappedTokenUserVaultProxy) {
        return IWrappedTokenUserVaultProxy(address(this));
    }
}
