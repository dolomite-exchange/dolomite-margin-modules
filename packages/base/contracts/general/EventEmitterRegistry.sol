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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable max-line-length
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   EventEmitterRegistry
 * @author  Dolomite
 *
 * @notice  Registry contract for storing ecosystem-related addresses
 */
contract EventEmitterRegistry is
    IEventEmitterRegistry,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "EventEmitter";

    // ================================================
    // =================== Modifiers ==================
    // ================================================

    modifier onlyTrustedTokenConverter(address _token, address _from) {
        _validateOnlyTrustedConverter(_token, _from);
        _;
    }

    // ================================================
    // =================== Functions ==================
    // ================================================

    function initialize() external initializer {
        // solhint-disable-previous-line no-empty-blocks
        // DolomiteMargin is set in the proxy constructor
    }

    function emitZapExecuted(
        address _accountOwner,
        uint256 _accountNumber,
        uint256[] calldata _marketIdsPath,
        IGenericTraderBase.TraderParam[] calldata _tradersPath
    )
        external
        onlyDolomiteMarginGlobalOperator(msg.sender)
    {
        emit ZapExecuted(
            _accountOwner,
            _accountNumber,
            _marketIdsPath,
            _tradersPath
        );
    }

    function emitBorrowPositionOpen(
        address _accountOwner,
        uint256 _accountNumber
    )
        external
        onlyDolomiteMarginGlobalOperator(msg.sender)
    {
        emit BorrowPositionOpen(
            _accountOwner,
            _accountNumber
        );
    }

    function emitMarginPositionOpen(
        address _accountOwner,
        uint256 _accountNumber,
        address _inputToken,
        address _outputToken,
        address _depositToken,
        BalanceUpdate calldata _inputBalanceUpdate,
        BalanceUpdate calldata _outputBalanceUpdate,
        BalanceUpdate calldata _marginDepositUpdate
    )
        external
    {
        _validateOnlyGlobalOperatorOrIsolationModeVault(msg.sender);
        emit MarginPositionOpen(
            _accountOwner,
            _accountNumber,
            _inputToken,
            _outputToken,
            _depositToken,
            _inputBalanceUpdate,
            _outputBalanceUpdate,
            _marginDepositUpdate
        );
    }

    function emitMarginPositionClose(
        address _accountOwner,
        uint256 _accountNumber,
        address _inputToken,
        address _outputToken,
        address _withdrawalToken,
        BalanceUpdate calldata _inputBalanceUpdate,
        BalanceUpdate calldata _outputBalanceUpdate,
        BalanceUpdate calldata _marginWithdrawalUpdate
    )
        external
        onlyDolomiteMarginGlobalOperator(msg.sender)
    {
        emit MarginPositionClose(
            _accountOwner,
            _accountNumber,
            _inputToken,
            _outputToken,
            _withdrawalToken,
            _inputBalanceUpdate,
            _outputBalanceUpdate,
            _marginWithdrawalUpdate
        );
    }

    function emitAsyncDepositCreated(
        bytes32 _key,
        address _token,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo calldata _deposit
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositCreated(_key, _token, _deposit);
    }

    function emitAsyncDepositOutputAmountUpdated(
        bytes32 _key,
        address _token,
        uint256 _outputAmount
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositOutputAmountUpdated(_key, _token, _outputAmount);
    }

    function emitAsyncDepositExecuted(
        bytes32 _key,
        address _token
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositExecuted(_key, _token);
    }

    function emitAsyncDepositFailed(
        bytes32 _key,
        address _token,
        string calldata _reason
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositFailed(_key, _token, _reason);
    }

    function emitAsyncDepositCancelled(
        bytes32 _key,
        address _token
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositCancelled(_key, _token);
    }

    function emitAsyncDepositCancelledFailed(
        bytes32 _key,
        address _token,
        string calldata _reason
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncDepositCancelledFailed(_key, _token, _reason);
    }

    function emitAsyncWithdrawalCreated(
        bytes32 _key,
        address _token,
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo calldata _withdrawal
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncWithdrawalCreated(_key, _token, _withdrawal);
    }

    function emitAsyncWithdrawalOutputAmountUpdated(
        bytes32 _key,
        address _token,
        uint256 _outputAmount
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncWithdrawalOutputAmountUpdated(_key, _token, _outputAmount);
    }

    function emitAsyncWithdrawalExecuted(
        bytes32 _key,
        address _token
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncWithdrawalExecuted(_key, _token);
    }

    function emitAsyncWithdrawalFailed(
        bytes32 _key,
        address _token,
        string calldata _reason
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncWithdrawalFailed(_key, _token, _reason);
    }

    function emitAsyncWithdrawalCancelled(
        bytes32 _key,
        address _token
    )
        external
        onlyTrustedTokenConverter(_token, msg.sender)
    {
        emit AsyncWithdrawalCancelled(_key, _token);
    }

    function emitDistributorRegistered(
        address _oTokenAddress,
        address _pairToken,
        address _paymentToken
    )
        external
        onlyDolomiteMarginGlobalOperator(msg.sender)
    {
        // The pair token and the payment token must be valid markets
        DOLOMITE_MARGIN().getMarketIdByTokenAddress(_pairToken);
        DOLOMITE_MARGIN().getMarketIdByTokenAddress(_paymentToken);
        emit DistributorRegistered(_oTokenAddress, _pairToken, _paymentToken);
    }

    function emitRewardClaimed(
        address _user,
        uint256 _epoch,
        uint256 _amount
    )
        external
        onlyDolomiteMarginGlobalOperator(msg.sender)
    {
        emit RewardClaimed(msg.sender, _user, _epoch, _amount);
    }

    // =================================================
    // ============== Internal Functions ===============
    // =================================================

    function _validateOnlyTrustedConverter(address _token, address _from) internal view {
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
        assert(marketId != 0); // getMarketIdByTokenAddress throws if the token is not listed.

        Require.that(
            IIsolationModeVaultFactory(_token).isTokenConverterTrusted(_from),
            _FILE,
            "Caller is not a converter",
            _from
        );
    }

    function _validateOnlyGlobalOperatorOrIsolationModeVault(address _from) internal view {
        if (DOLOMITE_MARGIN().getIsGlobalOperator(_from)) {
            return;
        }

        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _from,
            IIsolationModeTokenVaultV1.VAULT_FACTORY.selector,
            bytes("")
        );

        Require.that(
            isSuccess && returnData.length > 0,
            _FILE,
            "Caller is not authorized",
            _from
        );

        (address factory) = abi.decode(returnData, (address));

        // getMarketIdByTokenAddress throws if the token is not listed.
        assert(DOLOMITE_MARGIN().getMarketIdByTokenAddress(factory) != 0);

        Require.that(
            IIsolationModeVaultFactory(factory).getAccountByVault(_from) != address(0),
            _FILE,
            "Caller is not a token vault",
            _from
        );
    }
}
