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

// import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
// import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";

// /**
//  * @title   BGTIsolationModeUnwrapperTraderV2
//  * @author  Dolomite
//  *
//  * @notice  Used for unwrapping BGT (already is exchanged in wbera) into WBERA. Upon settlement,
//  *          the burned WBERA is sent from the user's vault to this contract and dBGT is burned from `DolomiteMargin`.
//  */
// contract BGTIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {

//     // ============ Constants ============

//     bytes32 private constant _FILE = "BGTIsolationModeUnwrapperV2";

//     // ============ Immutable State Variables ============

//     IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY; // solhint-disable-line var-name-mixedcase

//     // ============ Constructor ============

//     constructor(
//         address _berachainRewardsRegistry,
//         address _dBGT,
//         address _dolomiteMargin
//     )
//     IsolationModeUnwrapperTraderV2(
//         _dBGT,
//         _dolomiteMargin,
//         address(IBerachainRewardsRegistry(_berachainRewardsRegistry).dolomiteRegistry())
//     ) {
//         BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
//     }

//     // ==========================================
//     // ============ Public Functions ============
//     // ==========================================

//     function isValidOutputToken(address _outputToken) public override view returns (bool) {
//         return _outputToken == address(IBerachainRewardsRegistry(BERACHAIN_REWARDS_REGISTRY).wbera());
//     }

//     // ============================================
//     // ============ Internal Functions ============
//     // ============================================

//     function _exchangeUnderlyingTokenToOutputToken(
//         address,
//         address,
//         address,
//         uint256,
//         address,
//         uint256 _inputAmount,
//         bytes memory
//     )
//     internal
//     override
//     returns (uint256) {
//         return _inputAmount;
//     }

//     function _getExchangeCost(
//         address,
//         address,
//         uint256 _desiredInputAmount,
//         bytes memory
//     )
//     internal
//     override
//     view
//     returns (uint256) {
//         return _desiredInputAmount;
//     }
// }
