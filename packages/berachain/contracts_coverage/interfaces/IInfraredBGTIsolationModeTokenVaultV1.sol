// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   IInfraredBGTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on the InfraredBGTIsolationModeTokenVaultV1
 *          implementation contract for each user's proxy vault.
 */
interface IInfraredBGTIsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1 {
    event IsDepositSourceMetavaultSet(bool isDepositSourceMetavault);

    function setIsDepositSourceMetavault(bool _isDepositSourceMetavault) external;

    function isDepositSourceMetavault() external view returns (bool);
}
