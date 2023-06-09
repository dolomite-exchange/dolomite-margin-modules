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

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IDolomiteMarginWrapperTrader } from "../interfaces/IDolomiteMarginWrapperTrader.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IUniswapV2Router02 } from "../interfaces/IUniswapV2Router02.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";

/**
 * @title   SushiswapTrader
 * @author  Dolomite
 *
 * @notice  Used for swapping tokens. The output token is sent to
 *          DolomiteMargin, like normally
 */
contract SushiswapTrader is IDolomiteMarginWrapperTrader, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "SushiswapTrader";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ============ Constructor ============

    IUniswapV2Router02 public immutable SUSHI_ROUTER; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _sushiRouter,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        SUSHI_ROUTER = IUniswapV2Router02(_sushiRouter);
    }

    // ============ External Functions ============

    function exchange(
        address,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        // decode swap data
        (uint256 minOutputAmount, bytes memory pathData) = abi.decode(_orderData, (uint256, bytes));
        address[] memory path = abi.decode(pathData, (address[]));

        Require.that(
            path[0] == _inputToken,
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            path[path.length - 1] == _outputToken,
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // approve input token and do exchange
        IERC20(_inputToken).safeApprove(address(SUSHI_ROUTER), _inputAmount);
        uint256[] memory amounts = SUSHI_ROUTER.swapExactTokensForTokens(
            _inputAmount,
            minOutputAmount,
            path,
            address(this),
            block.timestamp
        );
        uint256 outputAmount = amounts[amounts.length - 1];

        // approve output token for receiver and return the amount
        IERC20(_outputToken).safeApprove(_receiver, outputAmount);
        return outputAmount;
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _pathData
    )
    public
    override
    view
    returns (uint256) {
        // decode swap data
        address[] memory path = abi.decode(_pathData, (address[]));
        Require.that(
            path[0] == _inputToken,
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            path[path.length - 1] == _outputToken,
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256[] memory amounts = SUSHI_ROUTER.getAmountsOut(_desiredInputAmount, path);
        return amounts[amounts.length - 1];
    }

    function createActionsForWrapping(
        uint256 _solidAccountId,
        uint256,
        address,
        address,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256,
        uint256 _inputAmount
    )
    public
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        address[] memory _path = new address[](2);
        _path[0] = DOLOMITE_MARGIN.getMarketTokenAddress(_inputMarket);
        _path[1] = DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarket);
        bytes memory _orderData = abi.encode(_path);
        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN.getMarketTokenAddress(_inputMarket),
            DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarket),
            _inputAmount,
            /* _orderData = */ _orderData
        );

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ amountOut,
            /* _orderData = */ _orderData
        );

        return actions;
    }

    function actionsLength() public pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }
}
