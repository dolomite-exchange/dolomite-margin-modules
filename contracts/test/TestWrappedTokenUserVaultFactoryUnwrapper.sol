// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { WrappedTokenUserVaultUnwrapper } from "../external/proxies/WrappedTokenUserVaultUnwrapper.sol";

import { ICustomTestToken } from "./ICustomTestToken.sol";


contract TestWrappedTokenUserVaultFactoryUnwrapper is WrappedTokenUserVaultUnwrapper {

    // ================ Immutable Field Variables ================

    address public immutable OUTPUT_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable OUTPUT_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ================ Constructor ================

    constructor(
        address _outputToken,
        address _vaultFactory,
        uint256 _actionsLength,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultUnwrapper(
        _vaultFactory,
        _actionsLength,
        _dolomiteMargin
    ) {
        OUTPUT_TOKEN = _outputToken;
        OUTPUT_MARKET_ID = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_outputToken);
    }

    function outputMarketId() external view returns (uint256) {
        return OUTPUT_MARKET_ID;
    }

    function getExchangeCost(
        address,
        address,
        uint256 _desiredMakerToken,
        bytes calldata
    )
    public
    override
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredMakerToken;
    }

    // ================ Internal Functions ================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256,
        address _takerTokenUnderlying,
        uint256 _amountTakerToken,
        bytes calldata
    )
    internal
    override
    returns (uint256) {
        uint256 outputAmount = _amountTakerToken;
        ICustomTestToken(_takerTokenUnderlying).addBalance(address(this), outputAmount);
        return outputAmount;
    }
}
