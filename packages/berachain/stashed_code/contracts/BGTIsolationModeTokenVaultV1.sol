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

// import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
// import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
// import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
// import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
// import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import { MetaVaultRewardReceiver } from "./MetaVaultRewardReceiver.sol";
// import { IBGTIsolationModeTokenVaultV1 } from "./interfaces/IBGTIsolationModeTokenVaultV1.sol";
// import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";


// /**
//  * @title   BGTIsolationModeTokenVaultV1
//  * @author  Dolomite
//  *
//  * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the BGT token
//  *          that can be used to credit a user's Dolomite balance. BGT held in the vault is considered to be in isolation
//  *          mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held
//  *          in the same position as other "isolated" tokens.
//  */
// contract BGTIsolationModeTokenVaultV1 is
//     MetaVaultRewardReceiver,
//     IBGTIsolationModeTokenVaultV1
// {
//     using SafeERC20 for IERC20;

//     // ==================================================================
//     // =========================== Constants ============================
//     // ==================================================================

//     bytes32 private constant _FILE = "BGTIsolationModeTokenVaultV1";

//     // ==================================================================
//     // =========================== Functions ============================
//     // ==================================================================

//     function executeDepositIntoVault(
//         address _from,
//         uint256 /* _amount */
//     )
//     public
//     override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
//     onlyVaultFactory(msg.sender) {
//         assert(_from == OWNER());
//         Require.that(
//             isDepositSourceMetaVault(),
//             _FILE,
//             "Only metaVault can deposit"
//         );
//         _setIsDepositSourceMetaVault(false);
//     }

//     function executeWithdrawalFromVault(
//         address _recipient,
//         uint256 _amount
//     )
//     public
//     override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
//     onlyVaultFactory(msg.sender) {
//         IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(registry().getMetaVaultByAccount(OWNER()));
//         assert(_recipient != address(this));
//         metaVault.withdrawBGTAndRedeem(_recipient, _amount);
//     }

//     function underlyingBalanceOf()
//         public
//         override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
//         view
//         returns (uint256)
//     {
//         IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(registry().getMetaVaultByAccount(OWNER()));
//         return metaVault.bgtBalanceOf();
//     }

//     function dolomiteRegistry()
//         public
//         override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
//         view
//         returns (IDolomiteRegistry)
//     {
//         return registry().dolomiteRegistry();
//     }

//     // ==================================================================
//     // ======================== Internal Functions ======================
//     // ==================================================================

//     function _depositIntoVaultForDolomiteMargin(
//         uint256 /* _toAccountNumber */,
//         uint256 /* _amountWei */
//     ) internal pure override {
//         revert("BGTIsolationModeTokenVaultV1: Not implemented");
//     }
// }
