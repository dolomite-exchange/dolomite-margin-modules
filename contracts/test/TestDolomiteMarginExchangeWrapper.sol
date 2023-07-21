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
import { ICustomTestToken } from "./ICustomTestToken.sol";
import { IDolomiteMarginExchangeWrapper } from "../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";
import { OnlyDolomiteMargin } from "../external/helpers/OnlyDolomiteMargin.sol";


/**
 * @title   TestDolomiteMarginExchangeWrapper
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeUnwrapperTrader contract.
 */
contract TestDolomiteMarginExchangeWrapper is IDolomiteMarginExchangeWrapper, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ================ Constructor ================

    constructor(
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function exchange(
        address,
        address _receiver,
        address _outputToken,
        address,
        uint256,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        (uint256 _outputAmount,) = abi.decode(_orderData, (uint256, bytes));
        ICustomTestToken(_outputToken).addBalance(address(this), _outputAmount);
        IERC20(_outputToken).safeApprove(_receiver, _outputAmount);
        return _outputAmount;
    }

    function getExchangeCost(
        address,
        address,
        uint256,
        bytes calldata _orderData
    )
    external
    pure
    returns (uint256) {
        (uint256 _outputAmount,) = abi.decode(_orderData, (uint256, bytes));
        return _outputAmount;
    }
}
