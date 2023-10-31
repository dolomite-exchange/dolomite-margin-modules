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
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
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
    using InterestIndexLib for IDolomiteMargin;
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "IsolationModeWrapperTraderV2";

    bytes32 private constant _DEPOSIT_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.depositInfo")) - 1);
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);

    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ======================== Field Variables ========================


    // ======================== External Functions ========================

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
        uint256 _primaryAccountId,
        uint256 /* _otherAccountId */,
        address /* _primaryAccountOwner */,
        address /* _otherAccountOwner */,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    public
    virtual
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        return AsyncIsolationModeWrapperTraderImpl.createActionsForWrapping(
            /* wrapper = */ this,
            _primaryAccountId,
            _outputMarket,
            _inputMarket,
            _minAmountOut,
            _inputAmount,
            _orderData
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
        return IIsolationModeVaultFactory(_getAddress(_VAULT_FACTORY_SLOT));
    }

    // ============ Internal Functions ============

    function _initializeWrapperTrader(
        address _vaultFactory,
        address _dolomiteMargin
    ) internal initializer {
        _setVaultFactory(_vaultFactory);
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
        _setDepositInfo(depositKey, depositInfo);
        _updateVaultPendingAmount(
            _tradeOriginator,
            accountNumber,
            _minOutputAmount,
            /* _isPositive = */ true
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

        IFreezableIsolationModeVaultFactory factory = IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY()));
        factory.setShouldVaultSkipTransfer(_depositInfo.vault, /* _shouldSkipTransfer = */ true);

        try AsyncIsolationModeWrapperTraderImpl.swapExactInputForOutputForDepositCancellation(
            /* _wrapper = */ this,
            _depositInfo
        ) {
            // The deposit info is set via `swapExactInputForOutputForDepositCancellation` by the unwrapper
            _eventEmitter().emitAsyncDepositCancelled(_depositInfo.key, address(factory));
        } catch Error(string memory _reason) {
            _depositInfo.isRetryable = true;
            _setDepositInfo(_depositInfo.key, _depositInfo);
            _eventEmitter().emitAsyncDepositCancelledFailed(_depositInfo.key, address(factory), _reason);
        } catch (bytes memory /* _reason */) {
            _depositInfo.isRetryable = true;
            _setDepositInfo(_depositInfo.key, _depositInfo);
            _eventEmitter().emitAsyncDepositCancelledFailed(_depositInfo.key, address(factory), /* _reason = */ "");
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

        if (maxWei != 0 && DOLOMITE_MARGIN().parToWei(marketId, supplyPar).value + _depositAmountWei >= maxWei) {
            // If the supplyPar is gte than the maxWei, then we should to transfer the deposit to the vault owner. It's
            // better to do this than to revert, since the user will be able to maintain control over the assets.
            IERC20 underlyingToken = IERC20(_factory.UNDERLYING_TOKEN());
            underlyingToken.safeTransfer(_factory.getAccountByVault(_depositInfo.vault), _depositAmountWei);
            // Reset the allowance to 0 since it won't be used
            underlyingToken.safeApprove(_depositInfo.vault, 0);
        } else {
            _factory.depositIntoDolomiteMarginFromTokenConverter(
                _depositInfo.vault,
                _DEFAULT_ACCOUNT_NUMBER,
                _depositAmountWei
            );
        }

        _clearDepositAndUpdatePendingAmount(_depositInfo);
    }

    function _clearDepositAndUpdatePendingAmount(
        DepositInfo memory _depositInfo
    ) internal {
        _updateVaultPendingAmount(
            _depositInfo.vault,
            _depositInfo.accountNumber,
            _depositInfo.outputAmount,
            /* _isPositive = */ false
        );
        // Setting the outputAmount to 0 clears it
        _depositInfo.outputAmount = 0;
        _setDepositInfo(_depositInfo.key, _depositInfo);
    }

    function _setDepositInfo(bytes32 _key, DepositInfo memory _info) internal {
        bool clearValues = _info.outputAmount == 0;
        DepositInfo storage storageInfo = _getDepositSlot(_key);
        storageInfo.key = _key;
        storageInfo.vault = clearValues ? address(0) : _info.vault;
        storageInfo.accountNumber = clearValues ? 0 : _info.accountNumber;
        storageInfo.inputToken = clearValues ? address(0) : _info.inputToken;
        storageInfo.inputAmount = clearValues ? 0 : _info.inputAmount;
        storageInfo.outputAmount = clearValues ? 0 : _info.outputAmount;
        storageInfo.isRetryable = clearValues ? false : _info.isRetryable;
    }

    function _setVaultFactory(address _factory) internal {
        _setAddress(_VAULT_FACTORY_SLOT, _factory);
    }

    function _updateVaultPendingAmount(
        address _vault,
        uint256 _accountNumber,
        uint256 _amountDeltaWei,
        bool _isPositive
    ) internal {
        IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY())).setVaultAccountPendingAmountForFrozenStatus(
            _vault,
            _accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Deposit,
            /* _amountDeltaWei = */ IDolomiteStructs.Wei({
                sign: _isPositive,
                value: _amountDeltaWei
            })
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

    function _validateDepositExists(DepositInfo memory _depositInfo) internal pure {
        Require.that(
            _depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );
    }

    function _getDepositSlot(bytes32 _key) internal pure returns (DepositInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_DEPOSIT_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
    }
}
