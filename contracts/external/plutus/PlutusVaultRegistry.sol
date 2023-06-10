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
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IPlutusVaultGLPFarm } from "../interfaces/plutus/IPlutusVaultGLPFarm.sol";
import { IPlutusVaultGLPRouter } from "../interfaces/plutus/IPlutusVaultGLPRouter.sol";
import { IPlutusVaultRegistry } from "../interfaces/plutus/IPlutusVaultRegistry.sol";


/**
 * @title   PlutusVaultRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the PlutusDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that PlutusDAO introduces.
 */
contract PlutusVaultRegistry is IPlutusVaultRegistry, OnlyDolomiteMargin {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "PlutusVaultRegistry";

    // ==================== Storage ====================

    IERC20 public override plutusToken;
    IERC4626 public override plvGlpToken;
    IPlutusVaultGLPRouter public override plvGlpRouter;
    IPlutusVaultGLPFarm public override plvGlpFarm;

    // ==================== Constructor ====================

    constructor(
        address _plutusToken,
        address _plvGlpToken,
        address _plvGlpRouter,
        address _plvGlpFarm,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        plutusToken = IERC20(_plutusToken);
        plvGlpToken = IERC4626(_plvGlpToken);
        plvGlpRouter = IPlutusVaultGLPRouter(_plvGlpRouter);
        plvGlpFarm = IPlutusVaultGLPFarm(_plvGlpFarm);
    }

    function ownerSetPlutusToken(
        address _plutusToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _plutusToken != address(0),
            _FILE,
            "Invalid plutusToken address"
        );
        plutusToken = IERC20(_plutusToken);
        emit PlutusTokenSet(_plutusToken);
    }

    function ownerSetPlvGlpToken(
        address _plvGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _plvGlpToken != address(0),
            _FILE,
            "Invalid plvGlpToken address"
        );
        plvGlpToken = IERC4626(_plvGlpToken);
        emit PlvGlpTokenSet(_plvGlpToken);
    }

    function ownerSetPlvGlpRouter(
        address _plvGlpRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _plvGlpRouter != address(0),
            _FILE,
            "Invalid plvGlpRouter address"
        );
        plvGlpRouter = IPlutusVaultGLPRouter(_plvGlpRouter);
        emit PlvGlpRouterSet(_plvGlpRouter);
    }

    function ownerSetPlvGlpFarm(
        address _plvGlpFarm
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _plvGlpFarm != address(0),
            _FILE,
            "Invalid plvGlpFarm address"
        );
        plvGlpFarm = IPlutusVaultGLPFarm(_plvGlpFarm);
        emit PlvGlpFarmSet(_plvGlpFarm);
    }
}
