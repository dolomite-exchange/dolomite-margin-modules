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

import { TokenWrapperLib } from "../external/lib/TokenWrapperLib.sol";

import { WrappedTokenUserVaultWrapper } from "../external/proxies/WrappedTokenUserVaultWrapper.sol";

import { ICustomTestToken } from "./ICustomTestToken.sol";


contract TestWrappedTokenUserVaultWrapper is WrappedTokenUserVaultWrapper {

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    ) WrappedTokenUserVaultWrapper(_vaultFactory, _dolomiteMargin) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getExchangeCost(
        address,
        address,
        uint256 _desiredMakerToken,
        bytes memory
    )
    public
    override
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredMakerToken;
    }

    // ================ Internal Functions ================

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address _makerTokenUnderlying,
        uint256,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes calldata
    )
    internal
    override
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        uint256 makerPrice = DOLOMITE_MARGIN.getMarketPrice(
            DOLOMITE_MARGIN.getMarketIdByTokenAddress(address(VAULT_FACTORY))
        ).value;
        uint256 takerPrice = DOLOMITE_MARGIN.getMarketPrice(
            DOLOMITE_MARGIN.getMarketIdByTokenAddress(_takerToken)
        ).value;
        uint256 outputAmount = _amountTakerToken * takerPrice / makerPrice;
        ICustomTestToken(_makerTokenUnderlying).addBalance(address(this), outputAmount);
        return outputAmount;
    }
}
