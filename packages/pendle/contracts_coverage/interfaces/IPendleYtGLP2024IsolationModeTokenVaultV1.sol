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

import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   IPendleYtGLPMar2024IsolationModeTokenVaultV1.sol
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeTokenVaultV1 that serves as the implementation for the user's proxy
 *          vault for ytGLP tokens.
 */
interface IPendleYtGLP2024IsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1 {

    function redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        bool[] memory _depositRewardsIntoDolomite,
        bool _depositInterestIntoDolomite
    ) external;
}
