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

import { ICustomTestToken } from "./ICustomTestToken.sol";
import { IsolationModeWrapperTraderV2 } from "../external/proxies/abstract/IsolationModeWrapperTraderV2.sol";


/**
 * @title   TestIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeWrapperTrader contract.
 */
contract TestIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {

    // ============ Immutable Storage ============

    address public immutable INPUT_TOKEN; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _inputToken,
        address _vaultFactory,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV2(
        _vaultFactory,
        _dolomiteMargin
    ) {
        INPUT_TOKEN = _inputToken;
    }

    // ============ Public Functions ============

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == INPUT_TOKEN;
    }

    // ================ Internal Functions ================

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address _outputTokenUnderlying,
        uint256,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _orderData
    )
    internal
    override
    returns (uint256) {
        uint256 outputAmount;
        if (_orderData.length > 0) {
            outputAmount = abi.decode(_orderData, (uint256));
        } else {
            // 1:1 conversion for the sake of
            uint256 outputPrice = _getMarketPriceForToken(address(VAULT_FACTORY));
            uint256 inputPrice = _getMarketPriceForToken(_inputToken);
            outputAmount = _inputAmount * inputPrice / outputPrice;
        }

        ICustomTestToken(_outputTokenUnderlying).addBalance(address(this), outputAmount);

        return outputAmount;
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredInputAmount;
    }

    function _getMarketPriceForToken(address _token) private view returns (uint256) {
        return DOLOMITE_MARGIN().getMarketPrice(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)).value;
    }
}
