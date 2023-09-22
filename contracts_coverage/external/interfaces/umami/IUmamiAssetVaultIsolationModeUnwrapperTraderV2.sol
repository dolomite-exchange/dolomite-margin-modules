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

import { IIsolationModeUnwrapperTrader } from "../IIsolationModeUnwrapperTrader.sol";


/**
 * @title   IUmamiAssetVaultIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping Umami Delta Neutral Asset Vaults (via redeeming shares for the underlying token).
 *          During settlement, the redeemed vault token is sent from the user's Isolation Mode vault to this contract to
 *          process the unwrapping.
 */
interface IUmamiAssetVaultIsolationModeUnwrapperTraderV2 is IIsolationModeUnwrapperTrader {

    struct WithdrawalInfo {
        bytes32 key;
        address vault;
        uint256 accountNumber;
        uint256 inputAmount;
        address outputToken;
        uint256 outputAmount;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event OwnerSetIsHandler(address _handler, bool _isTrusted);
    event WithdrawalCreated(bytes32 indexed key);
    event WithdrawalExecuted(bytes32 indexed key);

    // ================================================
    // ==================== Functions =================
    // ================================================

    function vaultSetWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken
    ) external;
}
