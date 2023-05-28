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

import { IERC4626 } from "./IERC4626.sol";


/**
 * @title   IPlutusVaultGLP
 * @author  Dolomite
 *
 * @notice  Interface for the ERC4626 plvGLP token
 */
interface IPlutusVaultGLP is IERC4626 {

    /**
     * @notice  Sets the risk parameters for the vault. Can only be called by owner.
     *
     * @return canMint      True if the mint function can be called
     * @return canWithdraw  True if the withdraw function can be called
     * @return canRedeem    True if the redeem function can be called
     * @return canDeposit   True if the deposit function can be called
     */
    function setParams(bool canMint, bool canWithdraw, bool canRedeem, bool canDeposit) external;

    /**
     *
     * @param  _newOwner The new owner of this contract after the call completes successfully
     */
    function transferOwnership(address _newOwner) external;

    /**
     * @return canMint      True if the mint function can be called
     * @return canWithdraw  True if the withdraw function can be called
     * @return canRedeem    True if the redeem function can be called
     * @return canDeposit   True if the deposit function can be called
     */
    function vaultParams() external view returns (bool canMint, bool canWithdraw, bool canRedeem, bool canDeposit);

    /**
     * @return The owner of this contract
     */
    function owner() external view returns (address);
}
