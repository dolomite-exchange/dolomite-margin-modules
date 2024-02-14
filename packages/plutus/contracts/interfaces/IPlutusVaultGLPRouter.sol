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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   IPlutusVaultGLPRouter
 * @author  Dolomite
 *
 * @notice  Interface for depositing/withdrawing plvGLP to/from the PlutusVaultGLPRouter contract.
 */
interface IPlutusVaultGLPRouter {

    function deposit(uint256 _amount) external;

    function redeem(uint256 _shares) external;

    function setWhitelist(address _whitelist) external;

    function previewRedeem(
        address _user,
        uint256 _shares
    )
    external
    view
    returns (
        uint256 _exitFeeLessRebate,
        uint256 _rebateAmount,
        uint256 _assetsLessFee
    );

    function getFeeBp(address _user) external view returns (uint256 _exitFeeBp, uint256 _rebateBp);

    function paused() external view returns (bool);

    function owner() external view returns (address);

    /**
     * @return  The sGLP token used by the Plutus router for transferring fsGLP to/from the PlutusDAO.
     */
    function sGLP() external view returns (IERC20);

    function whitelist() external view returns (address);
}
