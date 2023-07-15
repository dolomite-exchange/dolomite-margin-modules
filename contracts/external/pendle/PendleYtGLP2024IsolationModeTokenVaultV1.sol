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

import {IPendleYtGLP2024IsolationModeTokenVaultV1} from "../interfaces/pendle/IPendleYtGLP2024IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import {IPendleYtGLP2024IsolationModeVaultFactory} from "../interfaces/pendle/IPendleYtGLP2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import {IIsolationModeTokenVaultV1} from "../interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import {IPendleYtToken} from "../interfaces/pendle/IPendleYtToken.sol";
import {IsolationModeTokenVaultV1WithPausable} from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import {AccountBalanceLib} from "../lib/AccountBalanceLib.sol";

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
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendleYtGLP2024UserVaultV1";
    uint256 public constant MAX_EXPIRATION = 7 * 24 * 3600;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards
    ) external override nonReentrant onlyVaultOwner(msg.sender) {
        _redeemDueInterestAndRewards(_redeemInterest, _redeemRewards);
    }

    // function transferIntoPositionWithOtherToken(
    //     uint256 _fromAccountNumber,
    //     uint256 _borrowAccountNumber,
    //     uint256 _marketId,
    //     uint256 _amountWei,
    //     AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    // ) external override onlyVaultOwner(msg.sender) {
    //     _transferIntoPositionWithOtherToken(
    //         _fromAccountNumber,
    //         _borrowAccountNumber,
    //         _marketId,
    //         _amountWei,
    //         _balanceCheckFlag
    //     );
    // }

    // @todo Which function do I override to set expiry? How do I listen for when debt is accumulated

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

    // @follow-up Make sure these are supposed to go to the user and not back to the vault
    function _redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards
    ) internal {
        IPendleYtToken(UNDERLYING_TOKEN()).redeemDueInterestAndRewards(
            address(this),
            _redeemInterest,
            _redeemRewards
        );
    }
}
