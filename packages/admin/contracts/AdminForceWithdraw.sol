// SPDX-License-Identifier: GPL-3.0-or-later
/*
    Copyright 2025 Dolomite
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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IExpiry } from "@dolomite-exchange/modules-base/contracts/interfaces/IExpiry.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IAdminForceWithdraw } from "./interfaces/IAdminForceWithdraw.sol";


/**
 * @title   AdminForceWithdraw
 * @author  Dolomite
 *
 * @notice  AdminForceWithdraw contract that enables an admin to force withdrawal on behalf of a blacklisted user
 */
contract AdminForceWithdraw is OnlyDolomiteMargin, AdminRegistryHelper, IAdminForceWithdraw {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminForceWithdraw";
    IExpiry public immutable EXPIRY;

    // ===================================================================
    // ========================= State Variables =========================
    // ===================================================================

    uint256 public gracePeriod;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        uint256 _gracePeriod,
        address _expiry,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        EXPIRY = IExpiry(_expiry);

        _ownerSetGracePeriod(_gracePeriod);
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetGracePeriod(uint256 _gracePeriod) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGracePeriod(_gracePeriod);
    }

    function forceWithdraw(
        IDolomiteStructs.AccountInfo memory _account
    ) external checkPermission(this.forceWithdraw.selector, msg.sender) {
        if (DOLOMITE_MARGIN().getAccountNumberOfMarketsWithDebt(_account) == 0) {
            _forceWithdrawAllMarkets(_account);
        } else {
            _forceExpirePosition(_account);
        }
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _ownerSetGracePeriod(uint256 _gracePeriod) internal {
        Require.that(
            _gracePeriod > 0,
            _FILE,
            "Invalid grace period"
        );

        gracePeriod = _gracePeriod;
        emit GracePeriodSet(_gracePeriod);
    }

    function _forceWithdrawAllMarkets(
        IDolomiteStructs.AccountInfo memory _account
    ) internal {
        uint256[] memory markets = DOLOMITE_MARGIN().getAccountMarketsWithBalances(_account);

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](markets.length);

        accounts[0] = _account;

        for (uint256 i; i < markets.length; ++i) {
            actions[i] = AccountActionLib.encodeWithdrawalAction(
                _account.number,
                markets[i],
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Target,
                    value: 0
                }),
                _account.owner
            );
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _forceExpirePosition(
        IDolomiteStructs.AccountInfo memory _account
    ) internal {
        uint256[] memory markets = DOLOMITE_MARGIN().getAccountMarketsWithBalances(_account);

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](markets.length);

        accounts[0] = _account;

        for (uint256 i; i < markets.length; ++i) {

            actions[i] = AccountActionLib.encodeExpirationAction(
                _account,
                /* accountId = */ 0,
                markets[i],
                address(EXPIRY),
                /* _expiryTimeDelta = */ gracePeriod
            );
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }
}