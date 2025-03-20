// // SPDX-License-Identifier: GPL-3.0-or-later
// /*

//     Copyright 2024 Dolomite

//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.

//     You should have received a copy of the GNU General Public License
//     along with this program.  If not, see <http://www.gnu.org/licenses/>.

// */

// pragma solidity ^0.8.9;

// import { MetaVaultRewardTokenFactory } from "./MetaVaultRewardTokenFactory.sol";
// import { IBGTIsolationModeVaultFactory } from "./interfaces/IBGTIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length


// /**
//  * @title   BGTIsolationModeVaultFactory
//  * @author  Dolomite
//  *
//  * @notice  The wrapper around the BGT token that is used to create user vaults and manage the entry points that a
//  *          user can use to interact with DolomiteMargin from the vault.
//  */
// contract BGTIsolationModeVaultFactory is
//     IBGTIsolationModeVaultFactory,
//     MetaVaultRewardTokenFactory
// {
//     // ============ Constants ============

//     bytes32 private constant _FILE = "BGTIsolationModeVaultFactory";

//     // ============ Constructor ============

//     constructor(
//         address _berachainRewardsRegistry,
//         address _underlyingToken,
//         address _borrowPositionProxy,
//         address _userVaultImplementation,
//         address _dolomiteMargin
//     )
//     MetaVaultRewardTokenFactory(
//         /* _initialAllowableDebtMarketIds = */ new uint256[](0),
//         /* _initialAllowableCollateralMarketIds = */ new uint256[](0),
//         _berachainRewardsRegistry,
//         _underlyingToken,
//         _borrowPositionProxy,
//         _userVaultImplementation,
//         _dolomiteMargin
//     ) {}

//     // ============ External Functions ============

//     function allowableDebtMarketIds() external pure returns (uint256[] memory) {
//         // allow all markets
//         return new uint256[](0);
//     }

//     function allowableCollateralMarketIds() external pure returns (uint256[] memory) {
//         // allow all markets
//         return new uint256[](0);
//     }
// }
