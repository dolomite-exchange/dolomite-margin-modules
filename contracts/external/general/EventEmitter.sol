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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IEventEmitter } from "../interfaces/IEventEmitter.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable max-line-length


/**
 * @title   EventEmitter
 * @author  Dolomite
 *
 * @notice  Registry contract for storing ecosystem-related addresses
 */
contract EventEmitter is IEventEmitter, ProxyContractHelpers, OnlyDolomiteMarginForUpgradeable, Initializable {

    // ================================================
    // =================== Constants ==================
    // ================================================

    // ================================================
    // ==================== Events ====================
    // ================================================

    event AsyncWithdrawalCreated(bytes32 indexed key);
    event AsyncWithdrawalExecuted(bytes32 indexed key);
    event AsyncWithdrawalFailed(bytes32 indexed key, string reason);
    event AsyncWithdrawalCancelled(bytes32 indexed key);

    // ===================== Modifiers =====================

    modifier onlyTrustedTokenConverter(address _token, address _from) {
        Require.that(
            IIsolationModeVaultFactory(_token).isTokenConverterTrusted(_from),
            _FILE,
            "Caller is not a converter",
            _from
        );
        _;
    }

}
