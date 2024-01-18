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

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   ExpirationLib
 * @author  Dolomite
 *
 * @notice  Library contract for handling expiration logic
 */
library ExpirationLib {
    using TypesLib for IDolomiteStructs.Par;

    // ============ Constants ============

    bytes32 private constant _FILE = "ExpirationLib";

    // ============ Functions ============

    function clearExpirationIfNeeded(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteRegistry _registry,
        address _liquidAccountOwner,
        uint256 _liquidAccountNumber,
        uint256 _owedMarketId
    ) public {
        IExpiry expiry = _registry.expiry();
        IDolomiteStructs.AccountInfo memory expiredAccount = IDolomiteStructs.AccountInfo({
            owner: _liquidAccountOwner,
            number: _liquidAccountNumber
        });

        uint32 expirationTimestamp = expiry.getExpiry(expiredAccount, _owedMarketId);
        IDolomiteStructs.Par memory balancePar = _dolomiteMargin.getAccountPar(expiredAccount, _owedMarketId);

        if (expirationTimestamp != 0 && (balancePar.isZero() || balancePar.isPositive())) {
            // Unset the expiration if the owed balance was repaid
            IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
            accounts[0] = expiredAccount;

            IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
            actions[0] = AccountActionLib.encodeExpirationAction(
                expiredAccount,
                /* _accountId = */ 0,
                _owedMarketId,
                address(expiry),
                /* _expiryTimeDelta = */ 0
            );
            _dolomiteMargin.operate(accounts, actions);
        }
    }
}
