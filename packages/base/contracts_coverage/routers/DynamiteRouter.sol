// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

contract DynamiteRouter {

    event BorrowPositionOpen(address indexed owner, uint256 indexed number);

    bytes32 private constant _FILE = "DynamiteRouter";

    IDolomiteMargin public immutable DOLOMITE_MARGIN;
    uint256 public constant DEFAULT_ACCOUNT_ID = 0;

    enum EventFlag {
        None,
        Borrow
    }

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function depositAndBorrowWei(
        uint256 _accountNumber,
        uint256 _collateralMarketId,
        uint256 _debtMarketId,
        uint256 _collateralAmountWei,
        uint256 _debtAmountWei,
        EventFlag _eventFlag
    ) external {
        if (_eventFlag == EventFlag.Borrow) {
             emit BorrowPositionOpen(msg.sender, _accountNumber);
        }

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[DEFAULT_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _accountNumber
        });

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](2);
        actions[0] = AccountActionLib.encodeDepositAction(
            DEFAULT_ACCOUNT_ID,
            _collateralMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _collateralAmountWei
            }),
            msg.sender
        );
        actions[1] = AccountActionLib.encodeWithdrawalAction(
            DEFAULT_ACCOUNT_ID,
            _debtMarketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _debtAmountWei
            }),
            msg.sender
        );

        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    function repayAndWithdrawWei(
        uint256 _accountNumber,
        uint256 _repayMarketId,
        uint256 _collateralMarketId,
        uint256 _repayAmountWei,
        uint256 _withdrawAmountWei
    ) external {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[DEFAULT_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _accountNumber
        });

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](2);
        actions[0] = AccountActionLib.encodeDepositAction(
            DEFAULT_ACCOUNT_ID,
            _repayMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _repayAmountWei == type(uint256).max ? IDolomiteStructs.AssetReference.Target : IDolomiteStructs.AssetReference.Delta,
                value: _repayAmountWei == type(uint256).max ? 0 : _repayAmountWei
            }),
            msg.sender
        );
        actions[1] = AccountActionLib.encodeWithdrawalAction(
            DEFAULT_ACCOUNT_ID,
            _collateralMarketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _withdrawAmountWei == type(uint256).max ? IDolomiteStructs.AssetReference.Target : IDolomiteStructs.AssetReference.Delta,
                value: _withdrawAmountWei == type(uint256).max ? 0 : _withdrawAmountWei
            }),
            msg.sender
        );

        DOLOMITE_MARGIN.operate(accounts, actions);
    }
}
