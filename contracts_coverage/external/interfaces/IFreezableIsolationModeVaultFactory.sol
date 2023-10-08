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


/**
 * @title   IFreezableIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  A wrapper contract around a certain token to offer isolation mode features for DolomiteMargin and freezable
 *          vaults.
 */
interface IFreezableIsolationModeVaultFactory is IIsolationModeVaultFactory {

    event VaultAccountFrozen(
        address indexed vault,
        uint256 indexed accountNumber,
        bool isFrozen
    );

    function setIsVaultAccountFrozen(
        address _vault,
        uint256 _accountNumber,
        bool _isFrozen
    ) external;

    function isVaultFrozen(
        address _vault
    ) external view returns (bool);

    function isVaultAccountFrozen(
        address _vault,
        uint256 _accountNumber
    ) external view returns (bool);
}
