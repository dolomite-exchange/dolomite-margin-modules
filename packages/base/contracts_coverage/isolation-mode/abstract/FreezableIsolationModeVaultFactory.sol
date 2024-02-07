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
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IHandlerRegistry } from "../../interfaces/IHandlerRegistry.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "../interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
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

    // =========================================================
    // ==================== Field Variables ====================
    // =========================================================

    /// Vault ==> Account Number ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(uint256 => mapping(FreezeType => uint256))) private _accountInfoToPendingAmountWeiMap;

    mapping(address => mapping(uint256 => address)) private _accountInfoToOutputTokenMap;

    /// Vault ==> Freeze Type ==> Pending Amount
    mapping(address => mapping(FreezeType => uint256)) private _vaultToPendingAmountWeiMap;

    uint256 public maxExecutionFee = 1 ether;
    uint256 public override executionFee;
    IHandlerRegistry public override handlerRegistry;

    // ===========================================================
    // ======================= Modifiers ======================
    // ===========================================================

    modifier requireIsTokenConverterOrVaultOrDolomiteMarginOwner(address _caller) {
        if (_tokenConverterToIsTrustedMap[_caller] || _vaultToUserMap[_caller] != address(0) || DOLOMITE_MARGIN().owner() == _caller) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokenConverterToIsTrustedMap[_caller]
                || _vaultToUserMap[_caller] != address(0)
                || DOLOMITE_MARGIN().owner() == _caller,
            _FILE,
            "Caller is not a authorized",
            _caller
        );
        _;
    }

    // ===========================================================
    // ======================= Constructors ======================
    // ===========================================================

    constructor(uint256 _executionFee, address _handlerRegistry) {
        _ownerSetExecutionFee(_executionFee);
        _ownerSetHandlerRegistry(_handlerRegistry);
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

    function ownerSetMaxExecutionFee(
        uint256 _maxExecutionFee
    )
        external
        override
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetMaxExecutionFee(_maxExecutionFee);
    }

    function ownerSetHandlerRegistry(
        address _handlerRegistry
    )
        external
        override
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetHandlerRegistry(_handlerRegistry);
    }

    function setIsVaultDepositSourceWrapper(
        address _vault,
        bool _isDepositSourceWrapper
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _setIsVaultDepositSourceWrapper(_vault, _isDepositSourceWrapper);
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

    function setVaultAccountPendingAmountForFrozenStatus(
        address _vault,
        uint256 _accountNumber,
        FreezeType _freezeType,
        IDolomiteStructs.Wei calldata _amountDeltaWei,
        address _conversionToken
    )
        external
        requireIsTokenConverterOrVaultOrDolomiteMarginOwner(msg.sender)
        requireIsVault(_vault)
    {
        address expectedConversionToken = _accountInfoToOutputTokenMap[_vault][_accountNumber];
        if (expectedConversionToken == address(0) || expectedConversionToken == _conversionToken) { /* FOR COVERAGE TESTING */ }
        Require.that(
            expectedConversionToken == address(0) || expectedConversionToken == _conversionToken,
            _FILE,
            "Invalid output token",
            _conversionToken
        );

        if (_amountDeltaWei.isNegative()) {
            _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][_freezeType] -= _amountDeltaWei.value;
            _vaultToPendingAmountWeiMap[_vault][_freezeType] -= _amountDeltaWei.value;
        } else if (_amountDeltaWei.isPositive()) {
            _accountInfoToPendingAmountWeiMap[_vault][_accountNumber][_freezeType] += _amountDeltaWei.value;
            _vaultToPendingAmountWeiMap[_vault][_freezeType] += _amountDeltaWei.value;
        }

        bool isFrozen = isVaultAccountFrozen(_vault, _accountNumber);
        if (isFrozen) {
            _accountInfoToOutputTokenMap[_vault][_accountNumber] = _conversionToken;
        } else {
            _accountInfoToOutputTokenMap[_vault][_accountNumber] = address(0);
        }

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

    function getOutputTokenByAccount(
        address _vault,
        uint256 _accountNumber
    ) external view returns (address) {
        return _accountInfoToOutputTokenMap[_vault][_accountNumber];
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
        if (_executionFee <= maxExecutionFee) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _executionFee <= maxExecutionFee,
            _FILE,
            "Invalid execution fee"
        );
        executionFee = _executionFee;
        emit ExecutionFeeSet(_executionFee);
    }

    function _ownerSetMaxExecutionFee(
        uint256 _maxExecutionFee
    ) internal {
        maxExecutionFee = _maxExecutionFee;
        emit MaxExecutionFeeSet(_maxExecutionFee);
    }

    function _ownerSetHandlerRegistry(
        address _handlerRegistry
    ) internal {
        handlerRegistry = IHandlerRegistry(_handlerRegistry);
        emit HandlerRegistrySet(_handlerRegistry);
    }

    function _depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) internal virtual {
        _setIsVaultDepositSourceWrapper(_vault, /* _isDepositSourceWrapper = */ true);
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

    function _setIsVaultDepositSourceWrapper(
        address _vault,
        bool _isDepositSourceWrapper
    ) internal {
        IIsolationModeTokenVaultV1WithFreezable(_vault).setIsVaultDepositSourceWrapper(_isDepositSourceWrapper);
    }
}
