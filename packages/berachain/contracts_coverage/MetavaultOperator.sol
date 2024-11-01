// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   MetavaultOperator
 * @author  Dolomite
 *
 * @notice  Simple operator that will allow the metavault to deposit into any user's account
 */
contract MetavaultOperator is OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "MetavaultOperator";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    constructor(address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {}

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    // @audit We don't really need this contract anymore, but would this be ok? Allows anybody to
    // deposit into any user's account but that doesn't seem like a problem
    function depositIntoUserAccountFromMetavault(
        address _owner,
        address _token,
        uint256 _amountWei
    ) external {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amountWei);
        IERC20(_token).safeApprove(address(dolomiteMargin), _amountWei);

        AccountActionLib.deposit(
            dolomiteMargin,
            /* _accountOwner = */ _owner,
            /* _fromAccount = */ address(this),
            _DEFAULT_ACCOUNT_NUMBER,
            dolomiteMargin.getMarketIdByTokenAddress(_token),
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
    }
}
