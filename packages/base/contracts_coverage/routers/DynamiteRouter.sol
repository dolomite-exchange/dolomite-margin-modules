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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IDynamiteRouter } from "./interfaces/IDynamiteRouter.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { Require } from "../protocol/lib/Require.sol";

/**
 * @title   DynamiteRouter
 * @author  Dolomite
 *
 * @notice  Contract for depositing/borrowing and repaying/withdrawing in one transaction
 */
contract DynamiteRouter is IDynamiteRouter {
    using SafeERC20 for IERC20;

    // ================================================
    // ================== Constants ===================
    // ================================================

    bytes32 private constant _FILE = "DynamiteRouter";

    IDolomiteMargin public immutable DOLOMITE_MARGIN;
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    uint256 public constant DEFAULT_ACCOUNT_ID = 0;

    // ================================================
    // ================== Constructor =================
    // ================================================

    constructor(address _dolomiteMargin, address _dolomiteRegistry) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ================================================
    // ============== External Functions ==============
    // ================================================

    /// @inheritdoc IDynamiteRouter
    function depositAndBorrowWei(
        uint256 _accountNumber,
        uint256 _collateralMarketId,
        uint256 _debtMarketId,
        uint256 _collateralAmountWei,
        uint256 _debtAmountWei,
        EventFlag _eventFlag
    ) external {
        IERC20 collateralToken = IERC20(DOLOMITE_MARGIN.getMarketTokenAddress(_collateralMarketId));
        collateralToken.safeTransferFrom(msg.sender, address(this), _collateralAmountWei);

        _emitEventIfNecessary(msg.sender, _accountNumber, _eventFlag);

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
            address(this)
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

        collateralToken.approve(address(DOLOMITE_MARGIN), _collateralAmountWei);
        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    /// @inheritdoc IDynamiteRouter
    function repayAndWithdrawWei(
        uint256 _accountNumber,
        uint256 _repayMarketId,
        uint256 _collateralMarketId,
        uint256 _repayAmountWei,
        uint256 _withdrawAmountWei
    ) external {
        IERC20 repayToken = IERC20(DOLOMITE_MARGIN.getMarketTokenAddress(_repayMarketId));
        if (_repayAmountWei == type(uint256).max) {
            IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
                owner: msg.sender,
                number: _accountNumber
            });
            uint256 repayAmount = DOLOMITE_MARGIN.getAccountWei(accountInfo, _repayMarketId).value;
            repayToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        } else {
            repayToken.safeTransferFrom(msg.sender, address(this), _repayAmountWei);
        }

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
                ref: _repayAmountWei == type(uint256).max
                        ? IDolomiteStructs.AssetReference.Target
                        : IDolomiteStructs.AssetReference.Delta,
                value: _repayAmountWei == type(uint256).max ? 0 : _repayAmountWei
            }),
            address(this)
        );
        actions[1] = AccountActionLib.encodeWithdrawalAction(
            DEFAULT_ACCOUNT_ID,
            _collateralMarketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _withdrawAmountWei == type(uint256).max
                        ? IDolomiteStructs.AssetReference.Target
                        : IDolomiteStructs.AssetReference.Delta,
                value: _withdrawAmountWei == type(uint256).max ? 0 : _withdrawAmountWei
            }),
            msg.sender
        );

        repayToken.approve(address(DOLOMITE_MARGIN), _repayAmountWei);
        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    function _emitEventIfNecessary(
        address _accountOwner,
        uint256 _toAccountNumber,
        EventFlag _eventFlag
    ) internal {
        if (_eventFlag == EventFlag.Borrow) {
            if (_toAccountNumber >= 100) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _toAccountNumber >= 100,
                _FILE,
                "Invalid toAccountNumber"
            );
            DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(_accountOwner, _toAccountNumber);
        }
    }
}
