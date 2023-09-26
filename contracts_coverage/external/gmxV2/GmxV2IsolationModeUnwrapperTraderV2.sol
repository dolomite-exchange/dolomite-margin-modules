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
import { GmxV2IsolationModeTraderBase } from "./GmxV2IsolationModeTraderBase.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxWithdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxWithdrawalCallbackReceiver } from "../interfaces/gmx/IGmxWithdrawalCallbackReceiver.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { UpgradeableIsolationModeUnwrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   GmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GM (via withdrawing from GMX)
 */
contract GmxV2IsolationModeUnwrapperTraderV2 is
    IGmxV2IsolationModeUnwrapperTraderV2,
    UpgradeableIsolationModeUnwrapperTrader,
    GmxV2IsolationModeTraderBase,
    IGmxWithdrawalCallbackReceiver
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeUnwrapperV2";
    bytes32 private constant _WITHDRAWAL_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.withdrawalInfo")) - 1);

    // ============ Constructor ============

    receive() external payable {} // solhint-disable-line no-empty-blocks

    // ============ Initializer ============

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _gmxRegistryV2,
        address _weth,
        uint256 _callbackGasLimit
    )
    external initializer {
        _initializeUnwrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth, _callbackGasLimit);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function afterWithdrawalExecution(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        if (withdrawalInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );
        if (withdrawalInfo.inputAmount == _withdrawal.numbers.marketTokenAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.inputAmount == _withdrawal.numbers.marketTokenAmount,
            _FILE,
            "Invalid market token amount"
        );

        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = VAULT_FACTORY().marketId();
        marketIdsPath[1] = DOLOMITE_MARGIN().getMarketIdByTokenAddress(withdrawalInfo.outputToken);

        GmxEventUtils.AddressKeyValue memory outputTokenAddress = _eventData.addressItems.items[0];
        GmxEventUtils.UintKeyValue memory outputTokenAmount = _eventData.uintItems.items[0];
        GmxEventUtils.AddressKeyValue memory secondaryOutputTokenAddress = _eventData.addressItems.items[1];
        GmxEventUtils.UintKeyValue memory secondaryOutputTokenAmount = _eventData.uintItems.items[1];
        if (keccak256(abi.encodePacked(outputTokenAddress.key))== keccak256(abi.encodePacked("outputToken"))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(outputTokenAddress.key))
                == keccak256(abi.encodePacked("outputToken")),
            _FILE,
            "Unexpected outputToken"
        );
        if (keccak256(abi.encodePacked(outputTokenAmount.key))== keccak256(abi.encodePacked("outputAmount"))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(outputTokenAmount.key))
                == keccak256(abi.encodePacked("outputAmount")),
            _FILE,
            "Unexpected outputAmount"
        );
        if (keccak256(abi.encodePacked(secondaryOutputTokenAddress.key))== keccak256(abi.encodePacked("secondaryOutputToken"))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(secondaryOutputTokenAddress.key))
                == keccak256(abi.encodePacked("secondaryOutputToken")),
            _FILE,
            "Unexpected secondaryOutputToken"
        );
        if (keccak256(abi.encodePacked(secondaryOutputTokenAmount.key))== keccak256(abi.encodePacked("secondaryOutputAmount"))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(secondaryOutputTokenAmount.key))
                == keccak256(abi.encodePacked("secondaryOutputAmount")),
            _FILE,
            "Unexpected secondaryOutputAmount"
        );
        if (outputTokenAddress.value == secondaryOutputTokenAddress.value&& outputTokenAddress.value == withdrawalInfo.outputToken) { /* FOR COVERAGE TESTING */ }
        Require.that(outputTokenAddress.value == secondaryOutputTokenAddress.value
                && outputTokenAddress.value == withdrawalInfo.outputToken,
            _FILE,
            "Can only receive one token"
        );

        // @audit:  If GMX changes the keys OR if the data sent back is malformed (causing the above requires to
        //          fail), this will fail. This will result in us receiving tokens from GMX and not knowing who they
        //          are for, nor the amount. The only solution will be to upgrade this contract and have an admin
        //          "unstuck" the funds for users by sending them to the appropriate vaults.


        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(this);
        traderParams[0].tradeData = abi.encode((_key));

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig(
            block.timestamp,
            AccountBalanceLib.BalanceCheckFlag.None
        );

        // Save the output amount so we can refer to it later
        withdrawalInfo.outputAmount = outputTokenAmount.value + secondaryOutputTokenAmount.value;
        _setWithdrawalInfo(_key, withdrawalInfo);

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        factory.setShouldSkipTransfer(withdrawalInfo.vault, /* _shouldSkipTransfer = */ true);
        try IGmxV2IsolationModeTokenVaultV1(withdrawalInfo.vault).swapExactInputForOutput(
            withdrawalInfo.accountNumber,
            marketIdsPath,
            withdrawalInfo.inputAmount,
            withdrawalInfo.outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        ) {
            factory.setIsVaultFrozen(withdrawalInfo.vault, /* _isVaultFrozen = */ false);
            _setWithdrawalInfo(_key, _emptyWithdrawalInfo());
            emit WithdrawalExecuted(_key);
        } catch Error(string memory reason) {
            _handleCallbackError(
                _key,
                factory,
                withdrawalInfo,
                reason
            );
        } catch (bytes memory /* reason */) {
            _handleCallbackError(
                _key,
                factory,
                withdrawalInfo,
                /* _reason = */ ""
            );
        }
    }

    /**
     * @dev Funds will automatically be sent back to the vault by GMX
     */
    function afterWithdrawalCancellation(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory /* _withdrawal */,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        if (withdrawalInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );

        // @audit - Is there a way for us to verify the tokens were sent back to the vault?
        // The GM tokens are sent back to the vault
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        factory.setIsVaultFrozen(withdrawalInfo.vault, /* _isVaultFrozen = */ false);
        _setWithdrawalInfo(_key, _emptyWithdrawalInfo());
        emit WithdrawalCancelled(_key);
    }

    function vaultSetWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken
    ) external {
        if (address(VAULT_FACTORY().getAccountByVault(msg.sender)) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(address(VAULT_FACTORY().getAccountByVault(msg.sender)) != address(0),
            _FILE,
            "Invalid vault"
        );

        /*assert(_getWithdrawalSlot(_key).vault == address(0));*/ // panic if the key is already used
        // Disallow the withdrawal if there's already an action waiting for it
        GmxV2Library.checkVaultIsNotActive(GMX_REGISTRY_V2(), msg.sender, _accountNumber);

        _setWithdrawalInfo(_key, WithdrawalInfo({
            key: _key,
            vault: msg.sender,
            accountNumber: _accountNumber,
            inputAmount: _inputAmount,
            outputToken: _outputToken,
            outputAmount: 0
        }));
        emit WithdrawalCreated(_key);
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
    override(IDolomiteMarginExchangeWrapper, UpgradeableIsolationModeUnwrapperTrader)
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        if (_inputToken == address(VAULT_FACTORY())) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (isValidOutputToken(_outputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        uint256 outputAmount = _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY()),
            _inputAmount,
            extraOrderData
        );

        // @follow-up How to test this since _exchangeUnderlying returns the minOutputAmount
        if (outputAmount >= minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minOutputAmount
        );

        IERC20(_outputToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function createActionsForUnwrapping(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address,
        address,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    virtual
    override(UpgradeableIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTrader)
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket) == address(VAULT_FACTORY())) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket) == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input market",
            _inputMarket
        );
        if (isValidOutputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket))) { /* FOR COVERAGE TESTING */ }
        Require.that(isValidOutputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket)),
            _FILE,
            "Invalid output market",
            _outputMarket
        );

        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(abi.decode(_orderData, (bytes32)));
        // The vault address being correct is checked later
        if (withdrawalInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal"
        );
        if (withdrawalInfo.inputAmount >= _inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.inputAmount >= _inputAmount,
            _FILE,
            "Invalid input amount"
        );

        // If the input amount doesn't match, we need to add 2 actions to settle the difference
        uint256 actionsLength = _inputAmount < withdrawalInfo.inputAmount ? 4 : 2;
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength);

        // Transfer the IsolationMode tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            /* _callee */ address(this),
            /* (_transferAmount, _key)[encoded] = */ abi.encode(_inputAmount, withdrawalInfo.key)
        );
        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ _minAmountOut,
            _orderData
        );
        if (actionsLength == 4) {
            _inputAmount -= withdrawalInfo.inputAmount;
            actions[2] = AccountActionLib.encodeCallAction(
                _liquidAccountId,
                /* _callee */ address(this),
                /* (_transferAmount, _key)[encoded] = */ abi.encode(_inputAmount, withdrawalInfo.key)
            );
            actions[3] = AccountActionLib.encodeExternalSellAction(
                _liquidAccountId,
                _inputMarket,
                _outputMarket,
                /* _trader = */ address(this),
                /* _amountInWei = */ _inputAmount,
                /* _amountOutMinWei = */ 1,
                _orderData
            );
        }

        return actions;
    }

    function isValidOutputToken(
        address _outputToken
    )
    public
    view
    override(UpgradeableIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTrader)
    returns (bool) {
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).LONG_TOKEN();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).SHORT_TOKEN();
        return _outputToken == longToken || _outputToken == shortToken;
    }

    function getWithdrawalInfo(bytes32 _key) public pure returns (WithdrawalInfo memory) {
        return _getWithdrawalSlot(_key);
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _handleCallbackError(
        bytes32 _key,
        IGmxV2IsolationModeVaultFactory _factory,
        WithdrawalInfo memory _withdrawalInfo,
        string memory _reason
    ) internal {
        // Reset this value back to `false` since the transfer did not occur
        _factory.setShouldSkipTransfer(_withdrawalInfo.vault, /* _shouldSkipTransfer = */ false);
        emit WithdrawalFailed(_key, _reason);
    }

    function _exchangeUnderlyingTokenToOutputToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address _outputToken,
        uint256 _minOutputAmount,
        address /* _inputToken */,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
    internal
    virtual
    override
    returns (uint256) {
        // We don't need to validate _tradeOriginator here because it is validated in _callFunction via the transfer
        // being enqueued (without it being enqueued, we'd never reach this point)
        (bytes32 key) = abi.decode(_extraOrderData, (bytes32));
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
        if (withdrawalInfo.inputAmount >= _inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.inputAmount >= _inputAmount,
            _FILE,
            "Invalid input amount"
        );
        if (withdrawalInfo.outputToken == _outputToken) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.outputToken == _outputToken,
            _FILE,
            "Invalid output token"
        );
        if (withdrawalInfo.outputAmount >= _minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.outputAmount >= _minOutputAmount,
            _FILE,
            "Invalid output amount"
        );
        // Reduce output amount by the size of the ratio of the input amount. Almost always the ratio will be 100%.
        // During liquidations, there will be a non-100% ratio because the user may not lose all collateral to the
        // liquidator.
        uint256 outputAmount = withdrawalInfo.outputAmount * _inputAmount / withdrawalInfo.inputAmount;
        withdrawalInfo.inputAmount -= _inputAmount;
        withdrawalInfo.outputAmount -= outputAmount;
        _setWithdrawalInfo(key, withdrawalInfo);
        return outputAmount;
    }

    function _setWithdrawalInfo(bytes32 _key, WithdrawalInfo memory _info) internal {
        WithdrawalInfo storage storageInfo = _getWithdrawalSlot(_key);
        GMX_REGISTRY_V2().setIsAccountWaitingForCallback(
            storageInfo.vault,
            storageInfo.accountNumber,
            _info.vault != address(0)
        );
        storageInfo.key = _key;
        storageInfo.vault = _info.vault;
        storageInfo.accountNumber = _info.accountNumber;
        storageInfo.inputAmount = _info.inputAmount;
        storageInfo.outputToken = _info.outputToken;
        storageInfo.outputAmount = _info.outputAmount;
    }

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        if (VAULT_FACTORY().getAccountByVault(_accountInfo.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(VAULT_FACTORY().getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        (uint256 transferAmount, bytes32 key) = abi.decode(_data, (uint256, bytes32));
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
        if (withdrawalInfo.vault == _accountInfo.owner) { /* FOR COVERAGE TESTING */ }
        Require.that(withdrawalInfo.vault == _accountInfo.owner,
            _FILE,
            "Invalid account owner"
        );
        if (transferAmount > 0 && transferAmount <= withdrawalInfo.inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(transferAmount > 0 && transferAmount <= withdrawalInfo.inputAmount,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingVirtualBalance = IGmxV2IsolationModeTokenVaultV1(_accountInfo.owner).virtualBalance();
        if (underlyingVirtualBalance >= transferAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(underlyingVirtualBalance >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingVirtualBalance,
            transferAmount
        );

        VAULT_FACTORY().enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
    }

    function _getWithdrawalSlot(bytes32 _key) internal pure returns (WithdrawalInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_WITHDRAWAL_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }

    function _emptyWithdrawalInfo() internal pure returns (WithdrawalInfo memory) {
        return WithdrawalInfo({
            key: bytes32(0),
            vault: address(0),
            accountNumber: 0,
            inputAmount: 0,
            outputToken: address(0),
            outputAmount: 0
        });
    }
}
