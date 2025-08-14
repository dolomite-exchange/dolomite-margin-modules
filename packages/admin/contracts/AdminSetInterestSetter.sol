// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IModularLinearStepFunctionInterestSetter } from "@dolomite-exchange/modules-interest-setters/contracts/interfaces/IModularLinearStepFunctionInterestSetter.sol"; // solhint-disable-line max-line-length
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IAdminSetInterestSetter } from "./interfaces/IAdminSetInterestSetter.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminSetInterestSetter
 * @author  Dolomite
 *
 * @notice  AdminSetInterestSetter contract that enables an admin to set the interest setter for a market
 */
contract AdminSetInterestSetter is OnlyDolomiteMargin, AdminRegistryHelper, IAdminSetInterestSetter {

    bytes32 private constant _FILE = "AdminSetInterestSetter";
    bytes32 public constant ADMIN_SET_INTEREST_SETTER_ROLE = keccak256("ADMIN_SET_INTEREST_SETTER_ROLE");

    // ===================================================================
    // ======================= Field Variables ===========================
    // ===================================================================

    address public modularInterestSetter;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _modularInterestSetter,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        _ownerSetModularInterestSetter(_modularInterestSetter);
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetModularInterestSetter(
        address _modularInterestSetter
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetModularInterestSetter(_modularInterestSetter);
    }

    // ===================================================================
    // ========================= Public Functions ========================
    // ===================================================================

    function setInterestSetterByMarketId(
        uint256 _marketId,
        address _interestSetter
    )
    external
    checkPermission(this.setInterestSetterByMarketId.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetInterestSetter.selector,
                _marketId,
                _interestSetter
            )
        );
    }

    function setModularInterestSetterByMarketId(
        uint256 _marketId
    )
    external
    checkPermission(this.setModularInterestSetterByMarketId.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetInterestSetter.selector,
                _marketId,
                modularInterestSetter
            )
        );
    }

    function setInterestSettingsByToken(
        address _token,
        uint256 _lowerOptimalPercent,
        uint256 _upperOptimalPercent,
        uint256 _optimalUtilization
    )
    external
    checkPermission(this.setInterestSettingsByToken.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            modularInterestSetter,
            abi.encodeWithSelector(
                IModularLinearStepFunctionInterestSetter.ownerSetSettingsByToken.selector,
                _token,
                _lowerOptimalPercent,
                _upperOptimalPercent,
                _optimalUtilization
            )
        );
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _ownerSetModularInterestSetter(address _modularInterestSetter) internal {
        Require.that(
            _modularInterestSetter != address(0),
            _FILE,
            "Invalid modular interest setter"
        );
        modularInterestSetter = _modularInterestSetter;
        emit ModularInterestSetterSet(_modularInterestSetter);
    }
}
