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

import { IsolationModeVaultFactory } from "./IsolationModeVaultFactory.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { IFreezableIsolationModeVaultFactory } from "../../interfaces/IFreezableIsolationModeVaultFactory.sol";


/**
 * @title   FreezableIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Abstract contract for allowing freezable vaults (usually for handling async requests)
 */
abstract contract FreezableIsolationModeVaultFactory is
    IFreezableIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    using TypesLib for IDolomiteStructs.Wei;

    // ============ Field Variables ============

    /// Vault ==> Account Number ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(uint256 => mapping(FreezeType => uint256))) private _accountInfoToPendingAmountWeiMap;
    /// Vault ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(FreezeType => uint256)) private _vaultToPendingAmountWeiMap;

    // ============ Functions ============

    function updateVaultAccountPendingAmountForFrozenStatus(
        address _vault,
        uint256 _accountNumber,
        FreezeType _freezeType,
        IDolomiteStructs.Wei calldata _amountDeltaWei
    )
        external
        requireIsTokenConverterOrVault(msg.sender)
        requireIsVault(_vault)
    {
        if (_amountDeltaWei.isNegative()) {
            _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][_freezeType] -= _amountDeltaWei.value;
            _vaultToPendingAmountWeiMap[_vault][_freezeType] -= _amountDeltaWei.value;
        } else if (_amountDeltaWei.isPositive()) {
            _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][_freezeType] += _amountDeltaWei.value;
            _vaultToPendingAmountWeiMap[_vault][_freezeType] += _amountDeltaWei.value;
        }

        bool isFrozen = isVaultAccountFrozen(_vault, _accountNumber);
        emit VaultAccountFrozen(_vault, _accountNumber, isFrozen);
    }

    function isVaultFrozen(
        address _vault
    ) external view returns (bool) {
        return _vaultToPendingAmountWeiMap[_vault][FreezeType.Deposit] != 0
            || _vaultToPendingAmountWeiMap[_vault][FreezeType.Withdrawal] != 0;
    }

    function isVaultAccountFrozen(
        address _vault,
        uint256 _accountNumber
    ) public view returns (bool) {
        return _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][FreezeType.Deposit] != 0
            || _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][FreezeType.Withdrawal] != 0;
    }

    function getPendingAmountByAccount(
        address _vault,
        uint256 _accountNumber,
        FreezeType _freezeType
    ) external view returns (uint256) {
        return _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][_freezeType];
    }

    function getPendingAmountByVault(
        address _vault,
        FreezeType _freezeType
    ) external view returns (uint256) {
        return _vaultToPendingAmountWeiMap[_vault][_freezeType];
    }
}
