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

import { IERC4626 } from "./IERC4626.sol";
import { IPlutusVaultGLPFarm } from "./IPlutusVaultGLPFarm.sol";
import { IPlutusVaultGLPRouter } from "./IPlutusVaultGLPRouter.sol";


/**
 * @title   IPlutusVaultRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the PlutusDAO ecosystem.
 */
interface IPlutusVaultRegistry {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PlutusTokenSet(address indexed _plutusToken);
    event PlvGlpTokenSet(address indexed _plvGlpToken);
    event PlvGlpRouterSet(address indexed _plvGlpRouter);
    event PlvGlpFarmSet(address indexed _plvGlpFarm);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPlutusToken(address _plutusToken) external;

    function ownerSetPlvGlpToken(address _plvGlpToken) external;

    function ownerSetPlvGlpRouter(address _plvGlpRouter) external;

    function ownerSetPlvGlpFarm(address _plvGlpFarm) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function plutusToken() external view returns (IERC20);

    function plvGlpToken() external view returns (IERC4626);

    function plvGlpRouter() external view returns (IPlutusVaultGLPRouter);

    function plvGlpFarm() external view returns (IPlutusVaultGLPFarm);
}
