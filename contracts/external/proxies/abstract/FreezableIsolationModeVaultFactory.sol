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
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { IFreezableIsolationModeVaultFactory } from "../../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "../../interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { AccountActionLib } from "../../lib/AccountActionLib.sol";


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

    // =========================================================
    // ======================= Constants =======================
    // =========================================================

    bytes32 private constant _FILE = "FreezableVaultFactory";
    uint256 private constant _MAX_EXECUTION_FEE = 1 ether;

    // =========================================================
    // ==================== Field Variables ====================
    // =========================================================

    /// Vault ==> Account Number ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(uint256 => mapping(FreezeType => uint256))) private _accountInfoToPendingAmountWeiMap;

    /// Vault ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(FreezeType => uint256)) private _vaultToPendingAmountWeiMap;

    uint256 public override executionFee;

    // ===========================================================
    // ======================= Constructors ======================
    // ===========================================================

    constructor(uint256 _executionFee) {
        _ownerSetExecutionFee(_executionFee);
    }

    // ===========================================================
    // ===================== Public Functions ====================
    // ===========================================================

    function ownerSetExecutionFee(
        uint256 _executionFee
    )
        external
        override
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetExecutionFee(_executionFee);
    }

    function setIsVaultDepositSourceWrapper(
        address _vault,
        bool _isDepositSourceWrapper
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IIsolationModeTokenVaultV1WithFreezable(_vault).setIsVaultDepositSourceWrapper(_isDepositSourceWrapper);
    }

    function setShouldVaultSkipTransfer(
        address _vault,
        bool _shouldSkipTransfer
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IIsolationModeTokenVaultV1WithFreezable(_vault).setShouldVaultSkipTransfer(_shouldSkipTransfer);
    }

    function depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _depositIntoDolomiteMarginFromTokenConverter(
            _vault,
            _vaultAccountNumber,
            _amountWei
        );
    }

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

    function isVaultAccountFrozen(
        address _vault,
        uint256 _accountNumber
    ) public view returns (bool) {
        return _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][FreezeType.Deposit] != 0
            || _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][FreezeType.Withdrawal] != 0;
    }

    // ===========================================================
    // ==================== Internal Functions ===================
    // ===========================================================

    function _ownerSetExecutionFee(
        uint256 _executionFee
    ) internal {
        Require.that(
            _executionFee <= _MAX_EXECUTION_FEE,
            _FILE,
            "Invalid execution fee"
        );
        executionFee = _executionFee;
        emit ExecutionFeeSet(_executionFee);
    }

    function _depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) internal virtual {
        IIsolationModeTokenVaultV1WithFreezable(_vault).setIsVaultDepositSourceWrapper(
            /* _isDepositSourceWrapper = */ true
        );
        _enqueueTransfer(
            _vault,
            address(DOLOMITE_MARGIN()),
            _amountWei,
            _vault
        );
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ _vault,
            /* _fromAccount = */ _vault,
            _vaultAccountNumber,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
    }
}
