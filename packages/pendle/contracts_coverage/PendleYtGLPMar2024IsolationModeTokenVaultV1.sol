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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IExpiry } from "@dolomite-exchange/modules-base/contracts/interfaces/IExpiry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithPausable.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IPendleGLPRegistry } from "./interfaces/IPendleGLPRegistry.sol";
import { IPendleYtGLPMar2024IsolationModeTokenVaultV1 } from "./interfaces/IPendleYtGLPMar2024IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IPendleYtGLPMar2024IsolationModeVaultFactory } from "./interfaces/IPendleYtGLPMar2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IPendleYtToken } from "./interfaces/IPendleYtToken.sol";


/**
 * @title   PendleYtGLPMar2024IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the ytGLP (March 2024 expiration)
 *          token that can be used to credit a user's Dolomite balance.
 */
contract PendleYtGLPMar2024IsolationModeTokenVaultV1 is
IPendleYtGLPMar2024IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteMargin.Wei;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendleYtGLPMar2024UserVaultV1";
    uint256 private constant _ONE_WEEK = 1 weeks;
    uint256 private constant _SAFETY_BUFFER_SECONDS = 5 minutes;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        bool[] memory _depositRewardsIntoDolomite,
        bool _depositInterestIntoDolomite
    )
        external
        nonReentrant
        onlyVaultOwner(msg.sender)
    {
        _redeemDueInterestAndRewards(
            _redeemInterest,
            _redeemRewards,
            _depositRewardsIntoDolomite,
            _depositInterestIntoDolomite
        );
    }

    function registry() public view returns (IPendleGLPRegistry) {
        return IPendleYtGLPMar2024IsolationModeVaultFactory(VAULT_FACTORY()).pendleGLPRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public view override returns (bool) {
        return IPendleYtGLPMar2024IsolationModeVaultFactory(VAULT_FACTORY()).pendleGLPRegistry().syGlpToken().paused();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        bool[] memory _depositRewardsIntoDolomite,
        bool _depositInterestIntoDolomite
    ) internal {
        address underlyingToken = UNDERLYING_TOKEN();
        address[] memory rewardTokens = IPendleYtToken(underlyingToken).getRewardTokens();
        address interestToken = IPendleYtToken(underlyingToken).SY();
        uint256 rewardTokenLength = rewardTokens.length;

        if (_depositRewardsIntoDolomite.length == rewardTokenLength) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _depositRewardsIntoDolomite.length == rewardTokenLength,
            _FILE,
            "Array length mismatch"
        );

        (
            uint256 interestAmount,
            uint256[] memory rewardAmounts
        ) = IPendleYtToken(underlyingToken).redeemDueInterestAndRewards(
            address(this),
            _redeemInterest,
            _redeemRewards
        );

        for (uint256 i; i < rewardTokenLength; ++i) {
            /*assert(rewardTokens[i] != underlyingToken);*/
            _depositOtherTokenIntoDolomiteMarginForVaultOwnerOrTransferOut(
                /* _toAccountNumber = */ 0,
                rewardTokens[i],
                rewardAmounts[i],
                _depositRewardsIntoDolomite[i]
            );
        }

        /*assert(interestToken != underlyingToken);*/
        _depositOtherTokenIntoDolomiteMarginForVaultOwnerOrTransferOut(
            /* _toAccountNumber = */ 0,
            interestToken,
            interestAmount,
            _depositInterestIntoDolomite
        );
    }

    function _depositOtherTokenIntoDolomiteMarginForVaultOwnerOrTransferOut(
        uint256 _toAccountNumber,
        address _token,
        uint256 _amountWei,
        bool _depositIntoDolomite
    ) internal {
        if (_depositIntoDolomite) {
            IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
            IERC20(_token).safeApprove(address(dolomiteMargin), _amountWei);
            uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(_token);
            IIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                _toAccountNumber,
                marketId,
                _amountWei
            );
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amountWei);
        }
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        override
    {
        uint256 ytMaturityTimestamp = IPendleYtGLPMar2024IsolationModeVaultFactory(VAULT_FACTORY())
            .ytMaturityTimestamp();
        if (block.timestamp + _ONE_WEEK < ytMaturityTimestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            block.timestamp + _ONE_WEEK < ytMaturityTimestamp,
            _FILE,
            "Too close to expiry"
        );

        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
        internal
        override
    {
        IPendleYtGLPMar2024IsolationModeVaultFactory vaultFactory = IPendleYtGLPMar2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        );
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo(
            address(this),
            _params.tradeAccountNumber
        );
        IDolomiteStructs.Wei memory balanceAfterWei = _getBalanceAfterWei(
            accountInfo,
            _params.marketIdsPath[0],
            _params.inputAmountWei,
            vaultFactory
        );

        // check if balanceAfterWei is negative and it is within 1 week of expiry. If so, revert
        uint256 ytMaturityTimestamp = vaultFactory.ytMaturityTimestamp();
        if (block.timestamp + _ONE_WEEK < ytMaturityTimestamp || balanceAfterWei.isPositive() || balanceAfterWei.isZero()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            block.timestamp + _ONE_WEEK < ytMaturityTimestamp
                || balanceAfterWei.isPositive()
                || balanceAfterWei.isZero(),
            _FILE,
            "Too close to expiry"
        );

        super._swapExactInputForOutput(
            _params
        );

        // if account balance is negative, set expiry
        if (balanceAfterWei.isNegative()) {
            _setExpirationForBorrowPosition(accountInfo, _params.marketIdsPath[0], ytMaturityTimestamp, vaultFactory);
        }
    }


    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal override {
        IPendleYtGLPMar2024IsolationModeVaultFactory vaultFactory = IPendleYtGLPMar2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        );
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo(
            address(this),
            _borrowAccountNumber
        );
        IDolomiteStructs.Wei memory balanceAfterWei = _getBalanceAfterWei(
            accountInfo,
            _marketId,
            _amountWei,
            vaultFactory
        );

        // check if balanceAfterWei is negative and it is within 1 week of expiry. If so, revert
        uint256 ytMaturityTimestamp = vaultFactory.ytMaturityTimestamp();
        if (block.timestamp + _ONE_WEEK < ytMaturityTimestamp || balanceAfterWei.isPositive() || balanceAfterWei.isZero()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            block.timestamp + _ONE_WEEK < ytMaturityTimestamp
                || balanceAfterWei.isPositive()
                || balanceAfterWei.isZero(),
            _FILE,
            "Too close to expiry"
        );

        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        // if account balance is negative, set expiry
        if (balanceAfterWei.isNegative()) {
            _setExpirationForBorrowPosition(accountInfo, _marketId, ytMaturityTimestamp, vaultFactory);
        }
    }

    function _setExpirationForBorrowPosition(
        IDolomiteStructs.AccountInfo memory _accountInfo,
        uint256 _marketId,
        uint256 _ytMaturityTimestamp,
        IPendleYtGLPMar2024IsolationModeVaultFactory vaultFactory
    ) internal {
        IExpiry expiry = vaultFactory.pendleGLPRegistry().dolomiteRegistry().expiry();

        uint256 expirationTimestamp = _getExistingExpirationTimestampFromAccount(_accountInfo, expiry);
        if (expirationTimestamp == 0 || expirationTimestamp > _SAFETY_BUFFER_SECONDS + block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            expirationTimestamp == 0 || expirationTimestamp > _SAFETY_BUFFER_SECONDS + block.timestamp,
            _FILE,
            "Position is about to expire"
        );
        if (expiry.getExpiry(_accountInfo, _marketId) != 0) {
            // Expiration already exists, return
            return;
        }

        uint256 expiryTimeDelta;
        if (expirationTimestamp == 0) {
            // If an expiry doesn't exist, use the min of 4 weeks or the time until 1-week before YT's expiration
            expiryTimeDelta = Math.min(4 * _ONE_WEEK, _ytMaturityTimestamp - _ONE_WEEK - block.timestamp);
        } else {
            expiryTimeDelta = expirationTimestamp - block.timestamp;
        }

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[0] = _accountInfo;

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
        actions[0] = AccountActionLib.encodeExpirationAction(
            accounts[0],
            /* _accountId = */ 0,
            _marketId,
            address(expiry),
            expiryTimeDelta
        );

        vaultFactory.DOLOMITE_MARGIN().operate(accounts, actions);
    }

    /**
     * @notice  Returns the expiration timestamp for any existing borrow position on the vault
     *
     * @param  _accountInfo The account whose expirations will be checked
     * @param  _expiry      The Expiry contract to check for expirations on the account
     * @return              The expiration timestamp for this borrow account if one exists, else returns 0
     */
    function _getExistingExpirationTimestampFromAccount(
        IDolomiteStructs.AccountInfo memory _accountInfo,
        IExpiry _expiry
    ) internal view returns (uint256) {
        IPendleYtGLPMar2024IsolationModeVaultFactory vaultFactory = IPendleYtGLPMar2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        );

        uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
        uint256 allowableDebtMarketIdsLength = allowableDebtMarketIds.length;

        // Loop through all allowable debt markets checking for an expiry
        for (uint256 i = 0; i < allowableDebtMarketIdsLength; ++i) {
            uint256 existingExpiry = _expiry.getExpiry(_accountInfo, allowableDebtMarketIds[i]);
            if (existingExpiry != 0) {
                return existingExpiry;
            }
        }

        return 0;
    }

    function _getBalanceAfterWei(
        IDolomiteStructs.AccountInfo memory _accountInfo,
        uint256 _marketId,
        uint256 _inputAmountWei,
        IPendleYtGLPMar2024IsolationModeVaultFactory vaultFactory
    ) internal view returns (IDolomiteStructs.Wei memory balanceAfterWei) {
        IDolomiteStructs.Wei memory balanceBeforeWei = vaultFactory.DOLOMITE_MARGIN().getAccountWei(
            _accountInfo,
            _marketId
        );
        IDolomiteStructs.Wei memory deltaWei = IDolomiteStructs.Wei({
            sign: false,
            value: _inputAmountWei
        });
        balanceAfterWei = balanceBeforeWei.add(deltaWei);
    }
}
