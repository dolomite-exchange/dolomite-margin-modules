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

import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IWhitelist } from "../interfaces/IWhitelist.sol";


/**
 * @title   DolomiteCompatibleWhitelistForPlutusDAO
 * @author  Dolomite
 *
 * @notice  An implementation of Whitelist that can read if a DolomiteVault is whitelisted or not while using the
 *          original Plutus whitelist as a backup.
 */
contract DolomiteCompatibleWhitelistForPlutusDAO is IWhitelist, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "DolomiteCompatibleWhitelist";

    // ============================ Immutable State Variables ============================

    IWhitelist immutable public PLUTUS_WHITELIST; // solhint-disable-line var-name-mixedcase
    IIsolationModeVaultFactory immutable public DOLOMITE_PLV_GLP_WRAPPER; // solhint-disable-line var-name-mixedcase

    // ============================ Mutable State Variables ============================

    /// @dev    The address of the contract that's used to dynamically route plvGLP to USDC (or other GLP-compatible
    ///         assets).
    address public plvGlpUnwrapperTrader;

    /// @dev    The address of the contract that's used to dynamically route USDC (or other GLP-compatible assets) to
    ///         plvGLP.
    address public plvGlpWrapperTrader;

    // ============================ Events ============================

    event PlvGlpUnwrapperTraderSet(address indexed plvGlpUnwrapperTrader);
    event PlvGlpWrapperTraderSet(address indexed plvGlpWrapperTrader);

    // ============================ Constructor ============================

    constructor(
        address _plvGlpUnwrapperTrader,
        address _plvGlpWrapperTrader,
        address _plutusWhitelist,
        address _dolomitePlvGlpWrapper,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        PLUTUS_WHITELIST = IWhitelist(_plutusWhitelist);
        DOLOMITE_PLV_GLP_WRAPPER = IIsolationModeVaultFactory(_dolomitePlvGlpWrapper);

        _setPlvGlpUnwrapperTrader(_plvGlpUnwrapperTrader);
        _setPlvGlpWrapperTrader(_plvGlpWrapperTrader);
    }

    // ============================ External Functions ============================

    function ownerSetPlvGlpUnwrapperTrader(
        address _plvGlpUnwrapperTrader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _setPlvGlpUnwrapperTrader(_plvGlpUnwrapperTrader);
    }

    function ownerSetPlvGlpWrapperTrader(
        address _plvGlpWrapperTrader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _setPlvGlpWrapperTrader(_plvGlpWrapperTrader);
    }

    function isWhitelisted(address _caller) external view override returns (bool) {
        return PLUTUS_WHITELIST.isWhitelisted(_caller)
            || _isDolomiteVault(_caller)
            || _caller == plvGlpUnwrapperTrader
            || _caller == plvGlpWrapperTrader;
    }

    // ============================ Internal Functions ============================

    function _setPlvGlpUnwrapperTrader(
        address _plvGlpUnwrapperTrader
    ) internal {
        Require.that(
            _plvGlpUnwrapperTrader != address(0),
            _FILE,
            "Invalid plvGlpUnwrapperTrader"
        );
        plvGlpUnwrapperTrader = _plvGlpUnwrapperTrader;
        emit PlvGlpUnwrapperTraderSet(_plvGlpUnwrapperTrader);
    }

    function _setPlvGlpWrapperTrader(
        address _plvGlpWrapperTrader
    ) internal {
        Require.that(
            _plvGlpWrapperTrader != address(0),
            _FILE,
            "Invalid plvGlpWrapperTrader"
        );
        plvGlpWrapperTrader = _plvGlpWrapperTrader;
        emit PlvGlpWrapperTraderSet(_plvGlpWrapperTrader);
    }

    function _isDolomiteVault(address _caller) internal view returns (bool) {
        return DOLOMITE_PLV_GLP_WRAPPER.getAccountByVault(_caller) != address(0);
    }
}
