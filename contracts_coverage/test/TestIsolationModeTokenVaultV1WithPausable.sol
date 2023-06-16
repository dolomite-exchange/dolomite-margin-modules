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
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../external/proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol"; // solhint-disable-line max-line-length




/**
 * @title   TestIsolationModeTokenVaultV1WithPausable
 * @author  Dolomite
 *
 * @notice  A test contract for the TestIsolationModeTokenVaultV1WithPausable contract.
 */
contract TestIsolationModeTokenVaultV1WithPausable is IsolationModeTokenVaultV1WithPausable {
    using SafeERC20 for IERC20;

    bool private _isExternalRedemptionPaused;

    function setIsExternalRedemptionPaused(bool _newIsExternalRedemptionPaused) public {
        _isExternalRedemptionPaused = _newIsExternalRedemptionPaused;
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return _isExternalRedemptionPaused;
    }
}
