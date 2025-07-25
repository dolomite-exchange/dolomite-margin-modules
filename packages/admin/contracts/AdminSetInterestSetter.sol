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
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IModularLinearStepFunctionInterestSetter } from "@dolomite-exchange/modules-interest-setters/contracts/interfaces/IModularLinearStepFunctionInterestSetter.sol"; // solhint-disable-line max-line-length
import { IAdminSetInterestSetter } from "./interfaces/IAdminSetInterestSetter.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminSetInterestSetter
 * @author  Dolomite
 *
 * @notice  AdminSetInterestSetter contract that enables an admin to set the interest setter for a market
 */
contract AdminSetInterestSetter is OnlyDolomiteMargin, IAdminSetInterestSetter {

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "AdminSetInterestSetter";
    bytes32 public constant ADMIN_SET_INTEREST_SETTER_ROLE = keccak256("AdminSetInterestSetter");

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ===================================================================
    // ======================= Field Variables ===========================
    // ===================================================================

    mapping(address => bool) public isTrusted;
    address public modularInterestSetter;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _modularInterestSetter,
        address[] memory _trustedCallers,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);

        _ownerSetModularInterestSetter(_modularInterestSetter);
        for (uint256 i = 0; i < _trustedCallers.length; i++) {
            _ownerSetIsTrusted(_trustedCallers[i], true);
        }
    }

    // ===================================================================
    // ========================== Modifiers =============================
    // ===================================================================

    modifier onlyTrusted(address _interestSetter) {
        Require.that(
            isTrusted[_interestSetter],
            _FILE,
            "Caller is not trusted"
        );
        _;
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetIsTrusted(
        address[] memory _interestSetter,
        bool[] memory _isTrusted
    ) external onlyDolomiteMarginOwner(msg.sender) {
        for (uint256 i = 0; i < _interestSetter.length; i++) {
            _ownerSetIsTrusted(_interestSetter[i], _isTrusted[i]);
        }
    }

    function ownerSetModularInterestSetter(
        address _modularInterestSetter
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetModularInterestSetter(_modularInterestSetter);
    }

    // ===================================================================
    // ========================= Public Functions ========================
    // ===================================================================

    function setInterestSetterByMarketId(uint256 _marketId, address _interestSetter) external onlyTrusted(msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetInterestSetter.selector,
                _marketId,
                _interestSetter
            )
        );
    }

    function setModularInterestSetterByMarketId(uint256 _marketId) external onlyTrusted(msg.sender) {
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
    ) external onlyTrusted(msg.sender) {
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
        modularInterestSetter = _modularInterestSetter;
        emit ModularInterestSetterSet(_modularInterestSetter);
    }

    function _ownerSetIsTrusted(address _interestSetter, bool _isTrusted) internal {
        isTrusted[_interestSetter] = _isTrusted;
        emit IsTrustedSet(_interestSetter, _isTrusted);
    }
}
