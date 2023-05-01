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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { IWhitelist } from "../interfaces/IWhitelist.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";

import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title   DolomiteCompatibleWhitelist
 * @author  Dolomite
 *
 * @notice  An implementation of Whitelist that can read if a DolomiteVault is whitelisted or not while using the
 *          original Plutus whitelist as a backup.
 */
contract DolomiteCompatibleWhitelist is IWhitelist {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "DolomiteCompatibleWhitelist";

    // ============================ Public State Variables ============================

    IWhitelist immutable public OLD_WHITELIST; // solhint-disable-line var-name-mixedcase
    IWrappedTokenUserVaultFactory immutable public DOLOMITE_PLV_GLP_WRAPPER; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _oldWhitelist,
        address _dolomitePlvGlpWrapper
    ) {
        OLD_WHITELIST = IWhitelist(_oldWhitelist);
        DOLOMITE_PLV_GLP_WRAPPER = IWrappedTokenUserVaultFactory(_dolomitePlvGlpWrapper);
    }

    // ============================ External Functions ============================

    function isWhitelisted(address _caller) external view override returns (bool) {
        return OLD_WHITELIST.isWhitelisted(_caller) || _isDolomiteVault(_caller);
    }

    // ============================ Internal Functions ============================

    function _isDolomiteVault(address _caller) internal view returns (bool) {
        return DOLOMITE_PLV_GLP_WRAPPER.getAccountByVault(_caller) != address(0);
    }
}
