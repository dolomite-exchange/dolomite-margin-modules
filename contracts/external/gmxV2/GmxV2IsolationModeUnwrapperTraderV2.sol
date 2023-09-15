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

    receive() external payable {} // solhint-disable-line no-empty-blocks

    // ============ Initializer ============

    function initialize(
        address _gmxRegistryV2,
        address _weth,
        address _dGM,
        address _dolomiteMargin
    ) external initializer {
        _initializeUnwrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth);
        _setAddress(_GMX_REGISTRY_V2_SLOT, _gmxRegistryV2);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

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

        // @follow-up I think we can remove this check as _exchangeUnderlyingToken returns the minOutputAmount
        /*
        //     outputAmount >= minOutputAmount,
        //     _FILE,
        //     "Insufficient output amount",
        //     outputAmount,
        //     minOutputAmount
        // );
        */

        IERC20(_outputToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function afterWithdrawalExecution(
        bytes32 _key,
        GmxWithdrawal.Props memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
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

        GmxEventUtils.AddressKeyValue memory outputTokenAddress = _eventData.addressItems.items[0];
        GmxEventUtils.UintKeyValue memory outputTokenAmount = _eventData.uintItems.items[0];
        GmxEventUtils.AddressKeyValue memory secondaryOutputTokenAddress = _eventData.addressItems.items[1];
        GmxEventUtils.UintKeyValue memory secondaryOutputTokenAmount = _eventData.uintItems.items[1];
        Require.that(
            keccak256(abi.encodePacked(outputTokenAddress.key)) 
                == keccak256(abi.encodePacked("outputToken")),
            _FILE,
            "Unexpected return data"
        );
        Require.that(
            keccak256(abi.encodePacked(outputTokenAmount.key)) 
                == keccak256(abi.encodePacked("outputAmount")),
            _FILE,
            "Unexpected return data"
        );
        Require.that(
            keccak256(abi.encodePacked(secondaryOutputTokenAddress.key)) 
                == keccak256(abi.encodePacked("secondaryOutputToken")),
            _FILE,
            "Unexpected return data"
        );
        Require.that(
            keccak256(abi.encodePacked(secondaryOutputTokenAmount.key)) 
                == keccak256(abi.encodePacked("secondaryOutputAmount")),
            _FILE,
            "Unexpected return data"
        );
        Require.that(
            outputTokenAddress.value == secondaryOutputTokenAddress.value 
                && outputTokenAddress.value == withdrawalInfo.outputToken,
            _FILE,
            "Can only receive one token"
        );

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(this);
        traderParams[0].tradeData = bytes("");

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig(
            block.timestamp,
            AccountBalanceLib.BalanceCheckFlag.None
        );

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        factory.setShouldSkipTransfer(withdrawalInfo.vault, true);
        IGmxV2IsolationModeTokenVaultV1(withdrawalInfo.vault).swapExactInputForOutput(
            withdrawalInfo.accountNumber,
            marketIdsPath,
            _withdrawal.numbers.marketTokenAmount,
            outputTokenAmount.value  + secondaryOutputTokenAmount.value,
            traderParams,
            new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
        factory.setIsVaultFrozen(withdrawalInfo.vault, false);
        _setWithdrawalInfo(_key, WithdrawalInfo(address(0), 0, address(0)));
        emit WithdrawalExecuted(_key);
    }

    function afterWithdrawalCancellation(
        bytes32 _key,
        GmxWithdrawal.Props memory /* _withdrawal */,
        GmxEventUtils.EventLogData memory /* _eventData */
    ) 
    external 
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        Require.that(
            withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        IERC20 underlyingToken = IERC20(address(factory.UNDERLYING_TOKEN()));
        Require.that(
            IGmxV2IsolationModeTokenVaultV1(withdrawalInfo.vault).virtualBalance() 
                == underlyingToken.balanceOf(withdrawalInfo.vault),
            _FILE,
            "Virtual vs real balance mismatch"
        );

        factory.setIsVaultFrozen(withdrawalInfo.vault, false);
        _setWithdrawalInfo(_key, WithdrawalInfo(address(0), 0, address(0)));
        emit WithdrawalCancelled(_key);
    }

    function vaultSetWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        address _outputToken
    ) external {
        Require.that(
            address(VAULT_FACTORY().getAccountByVault(msg.sender)) != address(0),
            _FILE,
            "Invalid vault"
        );

        _setWithdrawalInfo(_key, WithdrawalInfo(msg.sender, _accountNumber, _outputToken));
        emit WithdrawalCreated(_key);
    }

    function isValidOutputToken(
        address _outputToken
    ) 
    public 
    view 
    override(UpgradeableIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTrader)
    returns (bool) {
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).longToken();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).shortToken();
        return _outputToken == longToken || _outputToken == shortToken;
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256 _minOutputAmount,
        address,
        uint256,
        bytes memory
    ) 
    internal
    virtual
    override
    returns (uint256) {
        return _minOutputAmount;
    }

    function _setWithdrawalInfo(bytes32 _key, WithdrawalInfo memory _info) internal {
        WithdrawalInfo storage storageInfo = _getWithdrawalSlot(_key);
        storageInfo.vault = _info.vault;
        storageInfo.accountNumber = _info.accountNumber;
        storageInfo.outputToken = _info.outputToken;
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
        (uint256 transferAmount) = abi.decode(_data, (uint256));
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingVirtualBalance = IGmxV2IsolationModeTokenVaultV1(_accountInfo.owner).virtualBalance();
        Require.that(
            underlyingVirtualBalance >= transferAmount,
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

}
