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

import { IIsolationModeTokenVaultV1 } from "../IIsolationModeTokenVaultV1.sol";


/**
 * @title   IGmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 */
interface IGmxV2IsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1 {

    function setIsVaultFrozen(bool _isVaultFrozen) external;

    function setIsDepositSourceWrapper(bool _isDepositSourceWrapper) external;

    function setShouldSkipTransfer(bool _shouldSkipTransfer) external;

    function virtualBalance() external view returns (uint256);
}
