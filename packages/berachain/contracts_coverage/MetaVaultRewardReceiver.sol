// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IMetaVaultRewardReceiver } from "./interfaces/IMetaVaultRewardReceiver.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol"; // solhint-disable-line max-line-length


/**
 * @title   MetaVaultRewardReceiver
 * @author  Dolomite
 *
 * @notice  This implementation for IMetaVaultRewardReceiver
 */
abstract contract MetaVaultRewardReceiver is IsolationModeTokenVaultV1, IMetaVaultRewardReceiver {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "MetaVaultRewardReceiver";
    bytes32 private constant _IS_DEPOSIT_SOURCE_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceMetaVault")) - 1); // solhint-disable-line max-line-length

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function setIsDepositSourceMetaVault(
        bool _isDepositSourceMetaVault
    ) external {
        if (msg.sender == registry().getMetaVaultByVault(address(this))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == registry().getMetaVaultByVault(address(this)),
            _FILE,
            "Only metaVault"
        );
        _setIsDepositSourceMetaVault(_isDepositSourceMetaVault);
    }

    function isDepositSourceMetaVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_META_VAULT_SLOT) == 1;
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IMetaVaultRewardTokenFactory(VAULT_FACTORY()).berachainRewardsRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _setIsDepositSourceMetaVault(bool _isDepositSourceMetaVault) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_META_VAULT_SLOT, _isDepositSourceMetaVault ? 1 : 0);
        emit IsDepositSourceMetaVaultSet(_isDepositSourceMetaVault);
    }
}
