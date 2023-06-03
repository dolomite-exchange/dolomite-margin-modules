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
import { IsolationModeUnwrapperTraderV2 } from "../external/proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   TestIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeUnwrapperTrader contract.
 */
contract TestIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {

    // ================ Immutable Field Variables ================

    address public immutable OUTPUT_TOKEN; // solhint-disable-line var-name-mixedcase

    // ================ Constructor ================

    constructor(
        address _outputToken,
        address _vaultFactory,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _vaultFactory,
        _dolomiteMargin
    ) {
        OUTPUT_TOKEN = _outputToken;
    }

    function isValidOutputToken(
        address _outputToken
    )
    public
    override
    view
    returns (bool) {
        return _outputToken == OUTPUT_TOKEN;
    }

    function getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredInputAmount;
    }

    // ================ Internal Functions ================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        uint256 outputPrice = DOLOMITE_MARGIN.getMarketPrice(
            DOLOMITE_MARGIN.getMarketIdByTokenAddress(address(VAULT_FACTORY))
        ).value;
        uint256 inputPrice = DOLOMITE_MARGIN.getMarketPrice(
            DOLOMITE_MARGIN.getMarketIdByTokenAddress(_inputToken)
        ).value;
        uint256 outputAmount = _inputAmount * inputPrice / outputPrice;
        ICustomTestToken(_outputToken).addBalance(address(this), outputAmount);
        return outputAmount;
    }
}
