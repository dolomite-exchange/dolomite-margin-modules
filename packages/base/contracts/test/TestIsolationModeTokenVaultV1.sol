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
import { TestSimpleIsolationModeVaultFactory } from "./TestSimpleIsolationModeVaultFactory.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { SimpleIsolationModeTokenVaultV1 } from "../isolation-mode/SimpleIsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1 } from "../isolation-mode/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1ActionsImpl } from "../isolation-mode/abstract/impl/IsolationModeTokenVaultV1ActionsImpl.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { BaseLiquidatorProxy } from "../proxies/BaseLiquidatorProxy.sol";


/**
 * @title   TestIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeTokenVaultV1 contract.
 */
contract TestIsolationModeTokenVaultV1 is SimpleIsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;

    function callDepositOtherTokenIntoDolomiteMarginForVaultOwner(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    ) external {
        IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId)).safeApprove(address(DOLOMITE_MARGIN()), _amountWei);

        IIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
            _toAccountNumber,
            _marketId,
            _amountWei
        );
    }

    function testReentrancy(bool _shouldReenter) public nonReentrant {
        if (_shouldReenter) {
            testReentrancy(false);
        }
    }

    function testReentrancyOnOtherFunction(bytes memory _data) public nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(_data);
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

    function testRequireNotLiquidatable(uint256 _accountNumber) requireNotLiquidatable(_accountNumber) public view {
        // This function is just to test the requireNotLiquidatable modifier.
    }

    function testGetMarketInfos(
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) public view returns (BaseLiquidatorProxy.MarketInfo[] memory) {
        return IsolationModeTokenVaultV1ActionsImpl._getMarketInfos(
            DOLOMITE_MARGIN(),
            _solidMarketIds,
            _liquidMarketIds
        );
    }

    function testBinarySearch(
        uint256[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) external view returns (BaseLiquidatorProxy.MarketInfo memory) {
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = testGetMarketInfos(
            new uint256[](0),
            _markets
        );
        return IsolationModeTokenVaultV1ActionsImpl._binarySearch(
            marketInfos,
            _beginInclusive,
            _endExclusive,
            _marketId
        );
    }

    function testGetAccountValuesWithAdjustMarginPremium(
        uint256 _accountNumber
    ) external view returns (
        IDolomiteStructs.MonetaryValue memory supplyValue,
        IDolomiteStructs.MonetaryValue memory borrowValue
    ) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory liquidAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _accountNumber
        });
        uint256[] memory marketsWithBalances = dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = IsolationModeTokenVaultV1ActionsImpl._getMarketInfos(
            dolomiteMargin,
            /* _solidMarketIds = */ new uint256[](0),
            marketsWithBalances
        );
        return IsolationModeTokenVaultV1ActionsImpl._getAccountValues(
            dolomiteMargin,
            marketInfos,
            liquidAccount,
            marketsWithBalances,
            false
        );
    }

    function testRequireOnlyConverter() external view {
        _requireOnlyConverter(msg.sender);
    }

    function testGetFunctionSelectors() external pure returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = IIsolationModeTokenVaultV1.transferIntoPositionWithOtherToken.selector;
        selectors[1] = IIsolationModeTokenVaultV1.transferIntoPositionWithUnderlyingToken.selector;
        selectors[2] = IIsolationModeTokenVaultV1.transferFromPositionWithUnderlyingToken.selector;
        selectors[3] = IIsolationModeTokenVaultV1.swapExactInputForOutput.selector;
        selectors[4] = IIsolationModeTokenVaultV1.transferFromPositionWithOtherToken.selector;
        selectors[5] = IIsolationModeTokenVaultV1.openMarginPosition.selector;
        selectors[6] = IIsolationModeTokenVaultV1.openBorrowPosition.selector;
        selectors[7] = IIsolationModeTokenVaultV1.withdrawFromVaultForDolomiteMargin.selector;
        selectors[8] = IIsolationModeTokenVaultV1.depositIntoVaultForDolomiteMargin.selector;
        return selectors;
    }

    function testSelectorBinarySearch(
        bytes4[] memory _selectors,
        bytes4 _selector
    ) external pure returns (bool) {
        return IsolationModeTokenVaultV1ActionsImpl.selectorBinarySearch(_selectors, _selector);
    }
}
