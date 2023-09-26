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

import { AccountActionLib } from "../external/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../external/lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";

/**
 * @title   TestAccountActionLib
 * @author  Dolomite
 *
 * @notice  Contract for testing pure library functions
 */
contract TestAccountActionLib {
    using AccountActionLib for IDolomiteMargin;

    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function deposit(
        address _accountOwner,
        address _fromAccount,
        uint256 _toAccountNumber,
        uint256 _marketId,
        IDolomiteMargin.AssetAmount memory _amount
    ) public {
        DOLOMITE_MARGIN.deposit(
            _accountOwner,
            _fromAccount,
            _toAccountNumber,
            _marketId,
            _amount
        );
    }

    function withdraw(
        address _accountOwner,
        uint256 _fromAccountNumber,
        address _toAccount,
        uint256 _marketId,
        IDolomiteStructs.AssetAmount memory _amount,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) public {
        DOLOMITE_MARGIN.withdraw(
            _accountOwner,
            _fromAccountNumber,
            _toAccount,
            _marketId,
            _amount,
            _balanceCheckFlag
        );
    }

    function transfer(
        address _fromAccountOwner,
        uint256 _fromAccountNumber,
        address _toAccountOwner,
        uint256 _toAccountNumber,
        uint256 _marketId,
        IDolomiteStructs.AssetDenomination _denomination,
        uint256 _amount,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) public {
        DOLOMITE_MARGIN.transfer(
            _fromAccountOwner,
            _fromAccountNumber,
            _toAccountOwner,
            _toAccountNumber,
            _marketId,
            _denomination,
            _amount,
            _balanceCheckFlag
        );
    }

    function encodeCallAction(
        uint256 _accountId,
        address _callee,
        bytes memory _callData
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeCallAction(
            _accountId,
            _callee,
            _callData
        );
    }

    function encodeDepositAction(
        uint256 _accountId,
        uint256 _marketId,
        IDolomiteStructs.AssetAmount memory _amount,
        address _fromAccount
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeDepositAction(
            _accountId,
            _marketId,
            _amount,
            _fromAccount
        );
    }

    function encodeExpirationAction(
        IDolomiteStructs.AccountInfo memory _account,
        uint256 _accountId,
        uint256 _owedMarketId,
        address _expiry,
        uint256 _expiryTimeDelta
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeExpirationAction(
            _account,
            _accountId,
            _owedMarketId,
            _expiry,
            _expiryTimeDelta
        );
    }

    function encodeExpiryLiquidateAction(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        uint256 _owedMarketId,
        uint256 _heldMarketId,
        address _expiryProxy,
        uint32 _expiry,
        bool _flipMarkets
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeExpiryLiquidateAction(
            _solidAccountId,
            _liquidAccountId,
            _owedMarketId,
            _heldMarketId,
            _expiryProxy,
            _expiry,
            _flipMarkets
        );
    }

    function encodeInternalTradeAction(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _traderAddress,
        uint256 _amountInWei,
        uint256 _amountOutWei
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeInternalTradeAction(
            _fromAccountId,
            _toAccountId,
            _primaryMarketId,
            _secondaryMarketId,
            _traderAddress,
            _amountInWei,
            _amountOutWei
        );
    }

    function encodeLiquidateAction(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        uint256 _owedMarketId,
        uint256 _heldMarketId,
        uint256 _owedWeiToLiquidate
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeLiquidateAction(
            _solidAccountId,
            _liquidAccountId,
            _owedMarketId,
            _heldMarketId,
            _owedWeiToLiquidate
        );
    }

    function encodeExternalSellAction(
        uint256 _fromAccountId,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _trader,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        bytes memory _orderData
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeExternalSellAction(
            _fromAccountId,
            _primaryMarketId,
            _secondaryMarketId,
            _trader,
            _amountInWei,
            _amountOutMinWei,
            _orderData
        );
    }

    function encodeTransferAction(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _marketId,
        IDolomiteStructs.AssetDenomination _denomination,
        uint256 _amount
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeTransferAction(
            _fromAccountId,
            _toAccountId,
            _marketId,
            _denomination,
            _amount
        );
    }

    function encodeWithdrawalAction(
        uint256 _accountId,
        uint256 _marketId,
        IDolomiteStructs.AssetAmount memory _amount,
        address _toAccount
    ) public pure returns (IDolomiteStructs.ActionArgs memory) {
        return AccountActionLib.encodeWithdrawalAction(
            _accountId,
            _marketId,
            _amount,
            _toAccount
        );
    }

    function all() public pure returns (uint256) {
        return AccountActionLib.all();
    }
}
