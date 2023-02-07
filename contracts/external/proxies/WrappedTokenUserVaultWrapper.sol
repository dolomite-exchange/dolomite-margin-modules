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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";

import { TokenWrapperLib } from "../lib/TokenWrapperLib.sol";


abstract contract WrappedTokenUserVaultWrapper is IDolomiteMarginExchangeWrapper, OnlyDolomiteMargin {

    // ======================== Constants ========================

    bytes32 private constant _FILE = "WrappedTokenUserVaultWrapper";

    // ======================== Field Variables ========================

    IWrappedTokenUserVaultFactory public immutable VAULT_FACTORY;

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        VAULT_FACTORY = IWrappedTokenUserVaultFactory(_vaultFactory);
    }

    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _makerToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid maker token",
            _makerToken
        );

        (address vault) = abi.decode(_orderData, (address));

        uint256 outputAmount = _exchange(
            _tradeOriginator,
            _receiver,
            _makerToken,
            _takerToken,
            _amountTakerToken,
            vault,
            _orderData
        );

        TokenWrapperLib.approveWrappedTokenForTransfer(_makerToken, vault, _receiver, outputAmount);

        return outputAmount;
    }

    // ============ Internal Functions ============

    function _exchange(
        address _tradeOriginator,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _amountTakerToken,
        address _vault,
        bytes calldata _orderData
    ) internal virtual returns (uint256);
}
