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
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableIsolationModeUnwrapperTrader } from "../../interfaces/IUpgradeableIsolationModeUnwrapperTrader.sol"; //solhint-disable-line max-line-length
import { AccountActionLib } from "../../lib/AccountActionLib.sol";

/**
 * @title   UpgradeableAsyncIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * @notice  Abstract contract for selling a vault token into the underlying token. Must be set as a token converter by
 *          the DolomiteMargin admin on the corresponding `IsolationModeVaultFactory` token to be used.
 */
abstract contract UpgradeableAsyncIsolationModeUnwrapperTrader is
    IUpgradeableIsolationModeUnwrapperTrader,
    AsyncIsolationModeTraderBase
{
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "UpgradeableUnwrapperTraderV2";
    uint256 private constant _ACTIONS_LENGTH = 2;

    // ======================== Field Variables ========================

    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);
    bytes32 private constant _REENTRANCY_GUARD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.reentrancyGuard")) - 1);
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // ======================== Modifiers ========================

    modifier nonReentrant() {
        // On the first call to nonReentrant, _reentrancyGuard will be _NOT_ENTERED
        Require.that(
            _getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED,
            _FILE,
            "Reentrant call"
        );

        // Any calls to nonReentrant after this point will fail
        _setReentrancyGuard(_ENTERED);

        _;

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _setReentrancyGuard(_NOT_ENTERED);
    }

    // ======================== External Functions ========================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    virtual
    onlyDolomiteMargin(msg.sender)
    onlyDolomiteMarginGlobalOperator(_sender) {
        _callFunction(_sender, _accountInfo, _data);
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
    virtual
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

        _requireBalanceIsSufficient(_inputAmount);

        uint256 outputAmount = _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY()),
            _inputAmount,
            extraOrderData
        );
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

    function token() external view returns (address) {
        return address(VAULT_FACTORY());
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
    override
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

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        // Transfer the IsolationMode tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            /* _callee */ address(this),
            /* _transferAmount[encoded] = */ abi.encode(_inputAmount)
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

    function actionsLength() external virtual view returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    function isValidOutputToken(address _outputToken) public override virtual view returns (bool);

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

    function VAULT_FACTORY() public view returns (IIsolationModeVaultFactory) {
        return IIsolationModeVaultFactory(_getAddress(_VAULT_FACTORY_SLOT));
    }

    // ============ Internal Functions ============

    function _initializeUnwrapperTrader(
        address _vaultFactory,
        address _dolomiteMargin
    ) internal initializer {
        _setVaultFactory(_vaultFactory);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
        _setReentrancyGuard(_NOT_ENTERED);
    }

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    virtual {
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

        uint256 underlyingBalanceOf = IIsolationModeTokenVaultV1(_accountInfo.owner).underlyingBalanceOf();
        Require.that(
            underlyingBalanceOf >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingBalanceOf,
            transferAmount
        );

        VAULT_FACTORY().enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
    }

    function _setVaultFactory(address _factory) internal {
        _setAddress(_VAULT_FACTORY_SLOT, _factory);
    }

    /**
     * @notice Performs the exchange from the Isolation Mode's underlying token to `_outputToken`.
     */
    function _exchangeUnderlyingTokenToOutputToken(
        address _tradeOriginator,
        address _receiver,
        address _outputToken,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) internal virtual returns (uint256);

    function _requireBalanceIsSufficient(uint256 _inputAmount) internal virtual view {
        uint256 balance = IERC20(VAULT_FACTORY().UNDERLYING_TOKEN()).balanceOf(address(this));
        Require.that(
            balance >= _inputAmount,
            _FILE,
            "Insufficient input token",
            balance,
            _inputAmount
        );
    }

    function _getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    ) internal virtual view returns (uint256);

    function _setReentrancyGuard(uint256 _value) private {
        _setUint256(_REENTRANCY_GUARD_SLOT, _value);
    }
}
