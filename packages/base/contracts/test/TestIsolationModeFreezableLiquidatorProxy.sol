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

 // solhint-disable max-line-length
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IsolationModeFreezableLiquidatorProxy } from "../proxies/IsolationModeFreezableLiquidatorProxy.sol";
 // solhint-enable max-line-length


/**
 * @title   TestIsolationModeFreezableLiquidatorProxy
 * @author  Dolomite
 *
 * @notice  Test contract for IsolationModeFreezableLiquidatorProxy
 */
contract TestIsolationModeFreezableLiquidatorProxy is
    IsolationModeFreezableLiquidatorProxy
{
    // ============================ Constructor ============================

    constructor(
        address _dolomiteRegistry,
        address _liquidatorAssetRegistry,
        address _dolomiteMargin,
        address _expiry,
        uint256 _chainId
    )
    IsolationModeFreezableLiquidatorProxy(
        _dolomiteRegistry,
        _liquidatorAssetRegistry,
        _dolomiteMargin,
        _expiry,
        _chainId
    ) {}

    function callPrepareForLiquidationAndTriggerReentrancy(
        PrepareForLiquidationParams calldata _params
    )
        external
        payable
        nonReentrant
    {
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.prepareForLiquidation.selector,
                _params
            )
        );
        if (!isSuccessful) {
            if (result.length < 68) {
                revert("No reversion message!");
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    result := add(result, 0x04) // Slice the sighash.
                }
            }
            (string memory errorMessage) = abi.decode(result, (string));
            revert(errorMessage);
        }
    }

    function testCheckIsLiquidatable(
        IDolomiteStructs.AccountInfo memory _liquidAccount
    ) external view {
        MarketInfo[] memory marketInfos = _getMarketInfos(
            /* _solidMarketIds = */ new uint256[](0),
            DOLOMITE_MARGIN().getAccountMarketsWithBalances(_liquidAccount)
        );
        (
            IDolomiteStructs.MonetaryValue memory liquidSupplyValue,
            IDolomiteStructs.MonetaryValue memory liquidBorrowValue
        ) = _getAdjustedAccountValues(
            marketInfos,
            _liquidAccount,
            DOLOMITE_MARGIN().getAccountMarketsWithBalances(_liquidAccount),
            IDolomiteStructs.Decimal({ value: 0 })
        );
        _checkIsLiquidatable(_liquidAccount, liquidSupplyValue, liquidBorrowValue);
    }
}
