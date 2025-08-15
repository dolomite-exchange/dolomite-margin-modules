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

import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IGmxV2Registry } from "./IGmxV2Registry.sol";
import { IGmxV22WithdrawalCallbackReceiver } from "./IGmxV22WithdrawalCallbackReceiver.sol";

/**
 * @title   IGmxV22IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 */
interface IGmxV22IsolationModeUnwrapperTraderV2 is
    IUpgradeableAsyncIsolationModeUnwrapperTrader,
    IGmxV22WithdrawalCallbackReceiver
{

    function GMX_REGISTRY_V2() external view returns (IGmxV2Registry);
}
