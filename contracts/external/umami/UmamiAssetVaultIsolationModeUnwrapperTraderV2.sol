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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { IUmamiAssetVaultIsolationModeTokenVaultV1 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeUnwrapperTraderV2 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeVaultFactory } from "../interfaces/umami/IUmamiAssetVaultIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { UpgradeableIsolationModeUnwrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   UmamiAssetVaultIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping Umami Delta Neutral Asset Vaults (via redeeming shares for the underlying token).
 *          During settlement, the redeemed vault token is sent from the user's Isolation Mode vault to this contract to
 *          process the unwrapping.
 */
contract UmamiAssetVaultIsolationModeUnwrapperTraderV2 is 
    IUmamiAssetVaultIsolationModeUnwrapperTraderV2,
    UpgradeableIsolationModeUnwrapperTrader 
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "UmamiAssetVaultUnwrapperV2";
    uint256 private constant _ACTIONS_LENGTH = 2;
    bytes32 private constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);
    bytes32 private constant _WITHDRAWAL_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.withdrawalInfo")) - 1);

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler(address _from) {
        Require.that(
            isHandler(_from),
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    // ============ Initializer ============

    function initialize(
        address _dUmamiAssetVault,
        address _dolomiteMargin
    )
    external initializer {
        _initializeUnwrapperTrader(_dUmamiAssetVault, _dolomiteMargin);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function afterWithdrawalExecution(
        bytes32 _key,
        uint256 _outputAmount
    )
    external
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        Require.that(
            withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );

        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = VAULT_FACTORY().marketId();
        marketIdsPath[1] = DOLOMITE_MARGIN().getMarketIdByTokenAddress(withdrawalInfo.outputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(this);
        traderParams[0].tradeData = abi.encode((_key));

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig(
            block.timestamp,
            AccountBalanceLib.BalanceCheckFlag.None
        );

        IUmamiAssetVaultIsolationModeVaultFactory factory = IUmamiAssetVaultIsolationModeVaultFactory(
            address(VAULT_FACTORY())
        );
        factory.setShouldSkipTransfer(withdrawalInfo.vault, true);
        IUmamiAssetVaultIsolationModeTokenVaultV1(withdrawalInfo.vault).swapExactInputForOutput(
            withdrawalInfo.accountNumber,
            marketIdsPath,
            withdrawalInfo.inputAmount,
            _outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );

        factory.setIsVaultFrozen(withdrawalInfo.vault, false);
        _setWithdrawalInfo(_key, _emptyWithdrawalInfo());
        emit WithdrawalExecuted(_key);
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
        Require.that(
            _inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
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
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minOutputAmount
        );

        IERC20(_outputToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function vaultSetWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken
    ) external {
        Require.that(
            address(VAULT_FACTORY().getAccountByVault(msg.sender)) != address(0),
            _FILE,
            "Invalid vault"
        );

        assert(_getWithdrawalSlot(_key).vault == address(0)); // panic if the key is used

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

    function ownerSetIsHandler(address _handler, bool _isTrusted) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsHandler(_handler, _isTrusted);
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
        Require.that(
            DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket) == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input market",
            _inputMarket
        );
        Require.that(
            isValidOutputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket)),
            _FILE,
            "Invalid output market",
            _outputMarket
        );

        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(abi.decode(_orderData, (bytes32)));
        // The vault address being correct is checked later
        Require.that(
            withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal"
        );
        Require.that(
            withdrawalInfo.inputAmount >= _inputAmount,
            _FILE,
            "Invalid input amount"
        );

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

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

        return actions;
    }

    function isValidOutputToken(
        address _outputToken
    )
    public 
    override(IIsolationModeUnwrapperTrader, UpgradeableIsolationModeUnwrapperTrader)
    view 
    returns (bool) {
        return IERC4626(VAULT_FACTORY().UNDERLYING_TOKEN()).asset() == _outputToken;
    }

    function isHandler(address _handler) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        return _getUint256(slot) == 1;
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

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
    override
    returns (uint256) {
        (bytes32 key) = abi.decode(_extraOrderData, (bytes32));
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
        Require.that(
            withdrawalInfo.inputAmount >= _inputAmount,
            _FILE,
            "Invalid input amount"
        );
        Require.that(
            withdrawalInfo.outputToken == _outputToken,
            _FILE,
            "Invalid output token"
        );
        //     withdrawalInfo.outputAmount >= _minOutputAmount,
        //     _FILE,
        //     "Invalid output amount"
        // );

        // Reduce output amount by the size of the ratio of the input amount. Almost always the ratio will be 100%.
        // During liquidations, there will be a non-100% ratio because the user may not lose all collateral to the
        // liquidator.

        // @follow-up Do we need these lines. I don't think so, but what to return
        // uint256 outputAmount = withdrawalInfo.outputAmount * _inputAmount / withdrawalInfo.inputAmount;
        // withdrawalInfo.inputAmount -= _inputAmount;
        // withdrawalInfo.outputAmount -= outputAmount;
        // _setWithdrawalInfo(_tradeOriginator, withdrawalInfo);
        return _minOutputAmount;
    }

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        Require.that(
            VAULT_FACTORY().getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        (uint256 transferAmount, bytes32 key) = abi.decode(_data, (uint256, bytes32));
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
        Require.that(
            withdrawalInfo.vault == _accountInfo.owner,
            _FILE,
            "Invalid account owner"
        );
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingVirtualBalance = 
            IUmamiAssetVaultIsolationModeTokenVaultV1(_accountInfo.owner).virtualBalance();
        Require.that(
            underlyingVirtualBalance >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingVirtualBalance,
            transferAmount
        );

        VAULT_FACTORY().enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
    }

    function _ownerSetIsHandler(address _handler, bool _isTrusted) internal {
        bytes32 slot =  keccak256(abi.encodePacked(_HANDLERS_SLOT, _handler));
        _setUint256(slot, _isTrusted ? 1 : 0);
        emit OwnerSetIsHandler(_handler, _isTrusted);
    }

    function _setWithdrawalInfo(bytes32 _key, WithdrawalInfo memory _info) internal {
        WithdrawalInfo storage storageInfo = _getWithdrawalSlot(_key);
        storageInfo.key = _key;
        storageInfo.vault = _info.vault;
        storageInfo.accountNumber = _info.accountNumber;
        storageInfo.inputAmount = _info.inputAmount;
        storageInfo.outputToken = _info.outputToken;
        storageInfo.outputAmount = _info.outputAmount;
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        return IERC4626(VAULT_FACTORY().UNDERLYING_TOKEN()).previewRedeem(_desiredInputAmount);
    }

    function _getWithdrawalSlot(bytes32 _key) internal pure returns (WithdrawalInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_WITHDRAWAL_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
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
