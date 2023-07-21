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

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {Require} from "../../protocol/lib/Require.sol";

import {IPendleYtGLP2024IsolationModeTokenVaultV1} from "../interfaces/pendle/IPendleYtGLP2024IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import {IPendleYtGLP2024IsolationModeVaultFactory} from "../interfaces/pendle/IPendleYtGLP2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import {IPendleYtToken} from "../interfaces/pendle/IPendleYtToken.sol";
import {IsolationModeTokenVaultV1WithPausable} from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import {IIsolationModeTokenVaultV1} from "../interfaces/IIsolationModeTokenVaultV1.sol";
import {AccountBalanceLib} from "../lib/AccountBalanceLib.sol";
import {IDolomiteStructs} from "../../protocol/interfaces/IDolomiteStructs.sol";
import {AccountActionLib} from "../lib/AccountActionLib.sol";
import {IDolomiteRegistry} from "../interfaces/IDolomiteRegistry.sol";

/**
 * @title   PendleYtGLP2024IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the ytGLP (March 2024 expiration)
 *          token that can be used to credit a user's Dolomite balance.
 */
contract PendleYtGLP2024IsolationModeTokenVaultV1 is
    IPendleYtGLP2024IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    using SafeERC20 for IERC20;
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendleYtGLP2024UserVaultV1";
    uint256 public constant ONE_WEEK = 7 * 24 * 3600;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        bool _sendToUser
    ) external nonReentrant onlyVaultOwner(msg.sender) {
        _redeemDueInterestAndRewards(
            _redeemInterest,
            _redeemRewards,
            _sendToUser
        );
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal override {
        // check if within 1 week of expiry, if yes, disallow
        uint256 ytMaturityDate = IPendleYtGLP2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        ).ytMaturityDate();
        Require.that(
            block.timestamp + ONE_WEEK < ytMaturityDate,
            _FILE,
            "too close to expiry"
        );

        // check if another borrow position exists
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs
            .AccountInfo(address(this), _borrowAccountNumber);
        uint256 expiry = _checkExistingBorrowPositions(accountInfo);

        // if expiry doesn't exist, use min formula
        if (expiry == 0) {
            expiry = Math.min(
                4 * ONE_WEEK,
                ytMaturityDate - ONE_WEEK - block.timestamp
            );
        }

        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        // set expiry
        IPendleYtGLP2024IsolationModeVaultFactory vaultFactory = IPendleYtGLP2024IsolationModeVaultFactory(
                VAULT_FACTORY()
            );

        IDolomiteStructs.AccountInfo[]
            memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[0] = accountInfo;

        IDolomiteStructs.ActionArgs[]
            memory actions = new IDolomiteStructs.ActionArgs[](1);
        actions[0] = AccountActionLib.encodeExpirationAction(
            accounts[0],
            0,
            _marketId,
            address(
                vaultFactory.pendleGLPRegistry().dolomiteRegistry().expiry()
            ),
            expiry
        );

        vaultFactory.DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function isExternalRedemptionPaused() public view override returns (bool) {
        return
            IPendleYtGLP2024IsolationModeVaultFactory(VAULT_FACTORY())
                .pendleGLPRegistry()
                .syGlpToken()
                .paused();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        bool _sendToUser
    ) internal {
        (, uint256[] memory rewardsOut) = IPendleYtToken(UNDERLYING_TOKEN())
            .redeemDueInterestAndRewards(
                address(this),
                _redeemInterest,
                _redeemRewards
            );

        if (_sendToUser) {
            address[] memory rewardTokens = IPendleYtToken(UNDERLYING_TOKEN())
                .getRewardTokens();
            for (uint i; i < rewardTokens.length; ++i) {
                IERC20(rewardTokens[i]).safeTransfer(msg.sender, rewardsOut[i]);
            }
        }
    }

    function _checkExistingBorrowPositions(
        IDolomiteStructs.AccountInfo memory info
    ) internal view returns (uint256) {
        IPendleYtGLP2024IsolationModeVaultFactory vaultFactory = IPendleYtGLP2024IsolationModeVaultFactory(
                VAULT_FACTORY()
            );
        uint256[] memory allowableDebtMarketIds = vaultFactory
            .allowableDebtMarketIds();

        uint256 expiry;
        if (allowableDebtMarketIds.length != 0) {
            for (uint256 i = 0; i < allowableDebtMarketIds.length; ++i) {
                expiry = vaultFactory
                    .pendleGLPRegistry()
                    .dolomiteRegistry()
                    .expiry()
                    .getExpiry(info, allowableDebtMarketIds[i]);
                if (expiry != 0) return expiry;
            }
        }
        return 0;
    }
}
