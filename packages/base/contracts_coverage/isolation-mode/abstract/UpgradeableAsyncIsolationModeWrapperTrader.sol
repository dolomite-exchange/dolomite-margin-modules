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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AsyncIsolationModeTraderBase } from "./AsyncIsolationModeTraderBase.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IHandlerRegistry } from "../../interfaces/IHandlerRegistry.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IIsolationModeWrapperTraderV2 } from "../interfaces/IIsolationModeWrapperTraderV2.sol";
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { InterestIndexLib } from "../../lib/InterestIndexLib.sol";
import { AsyncIsolationModeWrapperTraderImpl } from "./impl/AsyncIsolationModeWrapperTraderImpl.sol";


/**
 * @title   UpgradeableAsyncIsolationModeWrapperTrader
 * @author  Dolomite
 *
 * @notice  Abstract contract for wrapping a token into an IsolationMode token. Must be set as a token converter
 *          for the VaultWrapperFactory token.
 */
abstract contract UpgradeableAsyncIsolationModeWrapperTrader is
    IUpgradeableAsyncIsolationModeWrapperTrader,
    AsyncIsolationModeTraderBase
{
    using AsyncIsolationModeWrapperTraderImpl for State;
    using InterestIndexLib for IDolomiteMargin;
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "UpgradeableWrapperTraderV2";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _ACTIONS_LENGTH = 1;

    bytes32 private constant _STORAGE_STATE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.storageState")) - 1);


    // ======================== External Functions ========================

    function executeDepositCancellationForRetry(
        bytes32 _key
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        _validateIsRetryable(depositInfo.isRetryable);

        _executeDepositCancellation(depositInfo);
    }

    function setDepositInfoAndReducePendingAmountFromUnwrapper(
        bytes32 _key,
        uint256 _outputAmountDeltaWei,
        DepositInfo calldata _depositInfo
    ) external {
        Require.that(
            msg.sender == address(HANDLER_REGISTRY().getUnwrapperByToken(VAULT_FACTORY())),
            _FILE,
            "Only unwrapper can call",
            msg.sender
        );
        _updateVaultPendingAmount(
            _depositInfo.vault,
            _depositInfo.accountNumber,
            _outputAmountDeltaWei,
            /* _isPositive = */ false,
            _depositInfo.inputToken
        );

        // Get the delta by subtracting the old value (retrieved via `_getDepositSlot(_key)`) from the new one.
        // We should never underflow because this is only ever called when the deposit is reduced in size (hence the
        // function name)
        uint256 deltaInputWei = _getDepositSlot(_key).inputAmount - _depositInfo.inputAmount;
        IERC20(_depositInfo.inputToken).safeApprove(msg.sender, deltaInputWei);

        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _key, _depositInfo);
    }

    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            VAULT_FACTORY().getAccountByVault(_tradeOriginator) != address(0),
            _FILE,
            "Invalid trade originator",
            _tradeOriginator
        );
        Require.that(
            isValidInputToken(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            _outputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory _extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        uint256 outputAmount = _exchangeIntoUnderlyingToken(
            _tradeOriginator,
            _receiver,
            VAULT_FACTORY().UNDERLYING_TOKEN(),
            minOutputAmount,
            _inputToken,
            _inputAmount,
            _extraOrderData
        );
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minOutputAmount
        );

        _approveIsolationModeTokenForTransfer(_tradeOriginator, _receiver, outputAmount);

        return outputAmount;
    }

    function token() external override view returns (address) {
        return address(VAULT_FACTORY());
    }

    function actionsLength() external virtual override pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    function createActionsForWrapping(
        IIsolationModeWrapperTraderV2.CreateActionsForWrappingParams calldata _params
    )
    public
    virtual
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        return AsyncIsolationModeWrapperTraderImpl.createActionsForWrapping(
            /* wrapper = */ this,
            _params
        );
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            isValidInputToken(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            _outputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        return _getExchangeCost(
            _inputToken,
            _outputToken,
            _desiredInputAmount,
            _orderData
        );
    }

    function isValidInputToken(address _inputToken) public override virtual view returns (bool);

    function VAULT_FACTORY() public view returns (IIsolationModeVaultFactory) {
        State storage state = _getStorageSlot();
        return IIsolationModeVaultFactory(state.vaultFactory);
    }

    function HANDLER_REGISTRY() public view override returns (IHandlerRegistry) {
        State storage state = _getStorageSlot();
        return IHandlerRegistry(state.handlerRegistry);
    }

    function getDepositInfo(bytes32 _key) public view returns (DepositInfo memory) {
        return _getDepositSlot(_key);
    }

    // ============ Internal Functions ============

    function _initializeWrapperTrader(
        address _vaultFactory,
        address _handlerRegistry,
        address _dolomiteMargin
    ) internal initializer {
        _setVaultFactory(_vaultFactory);
        State storage state = _getStorageSlot();
        state.initializeWrapperTrader(_vaultFactory, _handlerRegistry);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    /**
     * @notice Performs the exchange from `_inputToken` into the factory's underlying token.
     */
    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address /* _receiver */,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _orderData
    )
    internal
    returns (uint256) {
        // Account number is set by the Token Vault so we know it's safe to use
        (uint256 accountNumber, bytes memory _extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        IFreezableIsolationModeVaultFactory factory = IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY()));

        // Disallow the deposit if there's already an action waiting for it
        Require.that(
            !factory.isVaultFrozen(_tradeOriginator),
            _FILE,
            "Vault is frozen",
            _tradeOriginator
        );

        bytes32 depositKey = _createDepositWithExternalProtocol(
            /* _vault = */ _tradeOriginator,
            _outputTokenUnderlying,
            _minOutputAmount,
            _inputToken,
            _inputAmount,
            _extraOrderData
        );

        DepositInfo memory depositInfo = DepositInfo({
            key: depositKey,
            vault: _tradeOriginator,
            accountNumber: accountNumber,
            inputToken: _inputToken,
            inputAmount: _inputAmount,
            outputAmount: _minOutputAmount,
            isRetryable: false
        });
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), depositKey, depositInfo);
        _updateVaultPendingAmount(
            _tradeOriginator,
            accountNumber,
            _minOutputAmount,
            /* _isPositive = */ true,
            depositInfo.inputToken
        );
        _eventEmitter().emitAsyncDepositCreated(depositKey, address(factory), depositInfo);

        factory.setShouldVaultSkipTransfer(
            _tradeOriginator,
            /* _shouldSkipTransfer = */ true
        );
        return _minOutputAmount;
    }

    function _approveIsolationModeTokenForTransfer(
        address _vault,
        address _receiver,
        uint256 _amount
    ) internal {
        VAULT_FACTORY().enqueueTransferIntoDolomiteMargin(_vault, _amount);
        IERC20(address(VAULT_FACTORY())).safeApprove(_receiver, _amount);
    }

    function _executeDepositExecution(
        bytes32 _key,
        uint256 _receivedMarketTokens,
        uint256 _minMarketTokens
    ) internal virtual {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        _validateDepositExists(depositInfo);

        IFreezableIsolationModeVaultFactory factory = IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY()));
        IERC20 underlyingToken = IERC20(factory.UNDERLYING_TOKEN());
        // We just need to blind transfer the min amount to the vault
        underlyingToken.safeTransfer(depositInfo.vault, _minMarketTokens);

        if (_receivedMarketTokens > _minMarketTokens) {
            // We need to send the diff into the vault via `operate` and
            uint256 diff = _receivedMarketTokens - _minMarketTokens;

            // The allowance is entirely spent in the call to `factory.depositIntoDolomiteMarginFromTokenConverter` or
            // `_depositIntoDefaultPositionAndClearDeposit`
            underlyingToken.safeApprove(depositInfo.vault, diff);

            // @audit   The only way this try-catch should throw is if there wasn't enough gas passed into the callback
            //          gas limit or if the user is underwater (after the deposit settles). We should always pass enough
            //          gas, though. If the user goes underwater, we'll want to recover as reasonably as possible. The
            //          way we do this is by initiating an unwrapping & then a liquidation via
            //          `IsolationModeFreezableLiquidatorProxy.sol`
            // @audit   This can also fail if the user pushes the GM token total supply on Dolomite past our supply cap
            //          How do we mitigate this? We don't know ahead of time how many tokens the user will get...
            // @audit   Are there any other "reasons" that the try-catch can fail that I'm missing here?
            factory.setShouldVaultSkipTransfer(depositInfo.vault, /* _shouldSkipTransfer = */ false);
            try factory.depositIntoDolomiteMarginFromTokenConverter(
                depositInfo.vault,
                depositInfo.accountNumber,
                diff
            ) {
                _clearDepositAndUpdatePendingAmount(depositInfo);
                _eventEmitter().emitAsyncDepositExecuted(_key, address(factory));
            } catch Error(string memory _reason) {
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
                _eventEmitter().emitAsyncDepositFailed(_key, address(factory), _reason);
            } catch (bytes memory /* _reason */) {
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
                _eventEmitter().emitAsyncDepositFailed(_key, address(factory), /* _reason = */ "");
            }
        } else {
            // There's nothing additional to send to the vault; clear out the deposit
            _clearDepositAndUpdatePendingAmount(depositInfo);
            _eventEmitter().emitAsyncDepositExecuted(_key, address(factory));
        }
    }

    function _executeDepositCancellation(
        DepositInfo memory _depositInfo
    ) internal virtual {
        _validateDepositExists(_depositInfo);

        try AsyncIsolationModeWrapperTraderImpl.swapExactInputForOutputForDepositCancellation(
            /* _wrapper = */ this,
            _depositInfo
        ) {
            // The deposit info is set via `swapExactInputForOutputForDepositCancellation` by the unwrapper
            _eventEmitter().emitAsyncDepositCancelled(
                _depositInfo.key,
                address(VAULT_FACTORY())
            );
        } catch Error(string memory _reason) {
            _setRetryableAndSaveDeposit(_depositInfo);
            _eventEmitter().emitAsyncDepositCancelledFailed(
                _depositInfo.key,
                address(VAULT_FACTORY()),
                _reason
            );
        } catch (bytes memory /* _reason */) {
            _setRetryableAndSaveDeposit(_depositInfo);
            _eventEmitter().emitAsyncDepositCancelledFailed(
                _depositInfo.key,
                address(VAULT_FACTORY()),
                /* _reason = */ ""
            );
        }
    }

    function _depositIntoDefaultPositionAndClearDeposit(
        IFreezableIsolationModeVaultFactory _factory,
        DepositInfo memory _depositInfo,
        uint256 _depositAmountWei
    ) internal {
        uint256 marketId = _factory.marketId();
        uint256 maxWei = DOLOMITE_MARGIN().getMarketMaxWei(marketId).value;
        IDolomiteStructs.Par memory supplyPar = IDolomiteStructs.Par({
            sign: true,
            value: DOLOMITE_MARGIN().getMarketTotalPar(marketId).supply
        });

        uint256 depositAmount;
        uint256 currentWeiSupply = DOLOMITE_MARGIN().parToWei(marketId, supplyPar).value;
        IERC20 underlyingToken = IERC20(_factory.UNDERLYING_TOKEN());
        if (maxWei != 0 && currentWeiSupply >= maxWei) {
            underlyingToken.safeTransfer(_factory.getAccountByVault(_depositInfo.vault), _depositAmountWei);
            underlyingToken.safeApprove(_depositInfo.vault, 0);
            _clearDepositAndUpdatePendingAmount(_depositInfo);
            return;
        }

        if (maxWei != 0 && currentWeiSupply + _depositAmountWei > maxWei) {
            depositAmount = maxWei - currentWeiSupply;
            // If the supplyPar is gte than the maxWei, then we should to transfer the leftover amount back to the vault
            // owner. It's better to do this than to revert, since the user will be able to maintain control
            // over the assets.
            underlyingToken.safeTransfer(
                _factory.getAccountByVault(_depositInfo.vault),
                _depositAmountWei - depositAmount
            );
        } else {
            depositAmount = _depositAmountWei;
        }
        _factory.setShouldVaultSkipTransfer(_depositInfo.vault, /* _shouldSkipTransfer = */ false);
        _factory.depositIntoDolomiteMarginFromTokenConverter(
            _depositInfo.vault,
            _DEFAULT_ACCOUNT_NUMBER,
            depositAmount
        );

        _clearDepositAndUpdatePendingAmount(_depositInfo);
        underlyingToken.safeApprove(_depositInfo.vault, 0);
    }

    function _clearDepositAndUpdatePendingAmount(
        DepositInfo memory _depositInfo
    ) internal {
        _updateVaultPendingAmount(
            _depositInfo.vault,
            _depositInfo.accountNumber,
            _depositInfo.outputAmount,
            /* _isPositive = */ false,
            _depositInfo.inputToken
        );
        // Setting the outputAmount to 0 clears it
        _depositInfo.outputAmount = 0;
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _depositInfo.key, _depositInfo);
    }

    function _setRetryableAndSaveDeposit(DepositInfo memory _depositInfo) internal {
        _depositInfo.isRetryable = true;
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _depositInfo.key, _depositInfo);
    }

    function _setVaultFactory(address _factory) internal {
        State storage state = _getStorageSlot();
        state.vaultFactory = _factory;
    }

    function _updateVaultPendingAmount(
        address _vault,
        uint256 _accountNumber,
        uint256 _amountDeltaWei,
        bool _isPositive,
        address _conversionToken
    ) internal {
        IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY())).setVaultAccountPendingAmountForFrozenStatus(
            _vault,
            _accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Deposit,
                /* _amountDeltaWei = */ IDolomiteStructs.Wei({
                sign: _isPositive,
                value: _amountDeltaWei
            }),
            _conversionToken
        );
    }

    function _createDepositWithExternalProtocol(
        address _vault,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) internal virtual returns (bytes32 _depositKey);

    function _getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    )
    internal
    virtual
    view
    returns (uint256);

    function _getDepositSlot(bytes32 _key) internal view returns (DepositInfo storage info) {
        State storage state = _getStorageSlot();
        return state.depositInfo[_key];
    }

    function _validateDepositExists(DepositInfo memory _depositInfo) internal pure {
        Require.that(
            _depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );
    }

    function _getStorageSlot() internal pure returns (State storage state) {
        bytes32 slot = _STORAGE_STATE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            state.slot := slot
        }
    }
}
