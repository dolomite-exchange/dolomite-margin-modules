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
// import { IBGTMIsolationModeVaultFactory } from "./interfaces/IBGTMIsolationModeVaultFactory.sol";
// import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


// /**
//  * @title   BGTMIsolationModeVaultFactory
//  * @author  Dolomite
//  *
//  * @notice  The wrapper around the BGTM token that is used to create user vaults and manage the entry points that a
//  *          user can use to interact with DolomiteMargin from the vault.
//  */
// contract BGTMIsolationModeVaultFactory is
//     IBGTMIsolationModeVaultFactory,
//     MetaVaultRewardTokenFactory
// {
//     // ============ Constants ============

//     bytes32 private constant _FILE = "BGTMIsolationModeVaultFactory";

//     uint256 public immutable BERA_MARKET_ID;

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
//     ) {
//         BERA_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(
//             address(IBerachainRewardsRegistry(_berachainRewardsRegistry).wbera())
//         );
//         uint256[] memory marketIds = new uint256[](1);
//         marketIds[0] = BERA_MARKET_ID; // @todo confirm tests for this

//         _ownerSetAllowableDebtMarketIds(marketIds);
//         _ownerSetAllowableCollateralMarketIds(marketIds);
//     }
// }
