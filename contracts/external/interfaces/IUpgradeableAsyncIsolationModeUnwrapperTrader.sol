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

import { IIsolationModeUnwrapperTrader } from "./IIsolationModeUnwrapperTrader.sol";
import { IIsolationModeVaultFactory } from "./IIsolationModeVaultFactory.sol";
import { IOnlyDolomiteMargin } from "./IOnlyDolomiteMargin.sol";


/**
 * @title   IUpgradeableAsyncIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * Interface for an upgradeable contract that can convert an isolation mode token into another token.
 */
interface IUpgradeableAsyncIsolationModeUnwrapperTrader is IIsolationModeUnwrapperTrader, IOnlyDolomiteMargin {

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct WithdrawalInfo {
        bytes32 key;
        address vault;
        uint256 accountNumber;
        /// @dev The amount of FACTORY tokens that is being sold
        uint256 inputAmount;
        address outputToken;
        /// @dev initially 0 until the withdrawal is executed
        uint256 outputAmount;
        bool isRetryable;
    }

    // ================================================
    // ===================== Enums ====================
    // ================================================

    enum TradeType {
        FromWithdrawal,
        FromDeposit
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    /**
     *
     * @param _key The key of the withdrawal that should be cancelled
     */
    function cancelWithdrawal(bytes32 _key) external;

    /**
     * Saves the follow withdrawal info as a struct. Only callable by the user's vault
     */
    function vaultCreateWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external;

    function getWithdrawalInfo(bytes32 _key) external view returns (WithdrawalInfo memory);

    function VAULT_FACTORY() external view returns (IIsolationModeVaultFactory);
}
