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

import { IIsolationModeVaultFactory } from "./IIsolationModeVaultFactory.sol";
import { IIsolationModeWrapperTrader } from "./IIsolationModeWrapperTrader.sol";
import { IOnlyDolomiteMargin } from "./IOnlyDolomiteMargin.sol";


/**
 * @title   IUpgradeableIsolationModeWrapperTrader
 * @author  Dolomite
 *
 * Interface for an upgradeable contract that can convert a token into an isolation mode token.
 */
interface IUpgradeableAsyncIsolationModeWrapperTrader is IIsolationModeWrapperTrader, IOnlyDolomiteMargin {

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct DepositInfo {
        bytes32 key;
        address vault;
        uint256 accountNumber;
        address inputToken;
        uint256 inputAmount;
        uint256 outputAmount;
        bool isRetryable;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event DepositCreated(bytes32 indexed key);
    event DepositExecuted(bytes32 indexed key);
    event DepositFailed(bytes32 indexed key, string reason);
    event DepositCancelled(bytes32 indexed key);
    event DepositCancelledFailed(bytes32 indexed key, string reason);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function cancelDeposit(bytes32 _key) external;

    function setDepositInfoAndReducePendingAmountFromUnwrapper(
        bytes32 _key,
        uint256 _outputAmountDeltaWei,
        DepositInfo calldata _depositInfo
    ) external;

    function getDepositInfo(bytes32 _key) external view returns (DepositInfo memory);

    function VAULT_FACTORY() external view returns (IIsolationModeVaultFactory);
}
