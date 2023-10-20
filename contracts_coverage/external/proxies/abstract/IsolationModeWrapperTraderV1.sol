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

import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../../helpers/OnlyDolomiteMargin.sol";

import { IDolomiteMarginWrapperTraderForLiquidatorV3 } from "../../interfaces/IDolomiteMarginWrapperTraderForLiquidatorV3.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";

import { AccountActionLib } from "../../lib/AccountActionLib.sol";


/**
 * @title   IsolationModeWrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Abstract contract for wrapping a token into an IsolationMode token. Must be set as a token converter
 *          for the VaultWrapperFactory token.
 */
abstract contract IsolationModeWrapperTraderV1 is IDolomiteMarginWrapperTraderForLiquidatorV3, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "IsolationModeWrapperTraderV1";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ======================== Field Variables ========================

    IIsolationModeVaultFactory public immutable VAULT_FACTORY; // solhint-disable-line var-name-mixedcase

    // ======================== Constructor ========================

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        VAULT_FACTORY = IIsolationModeVaultFactory(_vaultFactory);
    }

    // ======================== External Functions ========================

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
        if (_outputToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount) = abi.decode(_orderData, (uint256));

        uint256 outputAmount = _exchangeIntoUnderlyingToken(
            _tradeOriginator,
            _receiver,
            VAULT_FACTORY.UNDERLYING_TOKEN(),
            minOutputAmount,
            _inputToken,
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

        _approveIsolationModeTokenForTransfer(_tradeOriginator, _receiver, outputAmount);

        return outputAmount;
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
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket) == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket) == address(VAULT_FACTORY),
            _FILE,
            "Invalid output market",
            _outputMarket
        );
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket),
            DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket),
            _inputAmount,
            /* _orderData = */ bytes("")
        );

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ amountOut,
            bytes("")
        );

        return actions;
    }

    function actionsLength() external override pure returns (uint256) {
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

    // ============ Internal Functions ============

    /**
     * @notice Performs the exchange from `_inputToken` (could be anything) into the factory's underlying token.
     */
    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address _receiver,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _orderData
    ) internal virtual returns (uint256);

    function _approveIsolationModeTokenForTransfer(
        address _vault,
        address _receiver,
        uint256 _amount
    )
    internal
    virtual {
        VAULT_FACTORY.enqueueTransferIntoDolomiteMargin(_vault, _amount);

        address underlyingToken = VAULT_FACTORY.UNDERLYING_TOKEN();
        IERC20(underlyingToken).safeApprove(_vault, _amount);
        IERC20(address(VAULT_FACTORY)).safeApprove(_receiver, _amount);
    }
}
