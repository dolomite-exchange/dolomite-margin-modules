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
import { OnlyDolomiteMargin } from "../../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMarginUnwrapperTraderForLiquidatorV3 } from "../../interfaces/IDolomiteMarginUnwrapperTraderForLiquidatorV3.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "../../lib/AccountActionLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginCallee } from "../../protocol/interfaces/IDolomiteMarginCallee.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";


/**
 * @title   IsolationModeUnwrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Abstract contract for selling a vault token into the underlying token. Must be set as a token converter by
 *          the DolomiteMargin admin on the corresponding `IsolationModeVaultFactory` token to be used.
 */
abstract contract IsolationModeUnwrapperTraderV1 is
    IDolomiteMarginUnwrapperTraderForLiquidatorV3,
    IDolomiteMarginCallee,
    OnlyDolomiteMargin
{
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "IsolationModeUnwrapperTraderV1";
    uint256 private constant _ACTIONS_LENGTH = 2;

    // ======================== Field Variables ========================

    IIsolationModeVaultFactory public immutable VAULT_FACTORY; // solhint-disable-line var-name-mixedcase

    // ======================== Constructor ========================

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        VAULT_FACTORY = IIsolationModeVaultFactory(_vaultFactory);
    }

    // ======================== External Functions ========================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    onlyDolomiteMargin(msg.sender)
    onlyDolomiteMarginGlobalOperator(_sender) {
        if (VAULT_FACTORY.getAccountByVault(_accountInfo.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            VAULT_FACTORY.getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        (uint256 transferAmount) = abi.decode(_data, (uint256));
        if (transferAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingBalanceOf = IIsolationModeTokenVaultV1(_accountInfo.owner).underlyingBalanceOf();
        if (underlyingBalanceOf >= transferAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            underlyingBalanceOf >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingBalanceOf,
            transferAmount
        );

        VAULT_FACTORY.enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
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
        if (_inputToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount) = abi.decode(_orderData, (uint256));

        {
            uint256 balance = IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).balanceOf(address(this));
            if (balance >= _inputAmount) { /* FOR COVERAGE TESTING */ }
            Require.that(
                balance >= _inputAmount,
                _FILE,
                "Insufficient input token",
                balance,
                _inputAmount
            );
        }

        uint256 outputAmount = _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY),
            _inputAmount,
            _orderData
        );
        if (outputAmount >= minOutputAmount) { /* FOR COVERAGE TESTING */ }
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
        return address(VAULT_FACTORY);
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address,
        address,
        uint256,
        uint256 _inputMarket,
        uint256,
        uint256 _inputAmount
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);
        // Transfer the Wrapped Tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            address(this),
            /* _transferAmount[encoded] = */ abi.encode(_inputAmount)
        );

        uint256 _outputMarketId = outputMarketId();
        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket),
            DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId),
            _inputAmount,
            /* _orderData = */ bytes("")
        );

        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarketId,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ amountOut,
            bytes("")
        );

        return actions;
    }

    function actionsLength() external virtual pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    )
    public
    override
    virtual
    view
    returns (uint256);

    function outputMarketId() public override virtual view returns (uint256);

    // ============ Internal Functions ============

    /**
     * @notice Performs the exchange from the factory's underlying token to `_outputToken` (could be anything).
     */
    function _exchangeUnderlyingTokenToOutputToken(
        address _tradeOriginator,
        address _receiver,
        address _outputToken,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _orderData
    ) internal virtual returns (uint256);
}
