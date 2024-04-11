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

import { TestIsolationModeVaultFactory } from "./TestIsolationModeVaultFactory.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "../isolation-mode/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithAsyncFreezable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithAsyncFreezable.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithAsyncFreezableAndPausable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithAsyncFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IAsyncFreezableIsolationModeVaultFactory } from "../isolation-mode/interfaces/IAsyncFreezableIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable
 * @author  Dolomite
 *
 * @notice  A test contract for the TestIsolationModeTokenVaultV1WithFreezableAndPausable contract.
 */
contract TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable is IsolationModeTokenVaultV1WithAsyncFreezableAndPausable { // solhint-disable-line max-line-length

    // solhint-disable-next-line max-line-length
    bytes32 private constant _IS_EXTERNAL_REDEMPTION_PAUSED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isExternalRedemptionPaused")) - 1);

    // solhint-disable-next-line no-empty-blocks
    constructor(address _weth, uint256 _chainId) IsolationModeTokenVaultV1WithAsyncFreezable(_weth, _chainId) {}

    function setIsExternalRedemptionPaused(bool _newIsExternalRedemptionPaused) public {
        _setUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT, _newIsExternalRedemptionPaused ? 1 : 0);
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return TestIsolationModeVaultFactory(VAULT_FACTORY()).dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return _getUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT) == 1;
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 /* _minOutputAmount */,
        bool _isLiquidation,
        bytes calldata /* _extraData */
    ) internal override {
        if (_isLiquidation) {
            IAsyncFreezableIsolationModeVaultFactory(VAULT_FACTORY()).setVaultAccountPendingAmountForFrozenStatus(
                /* _vault = */ address(this),
                _tradeAccountNumber,
                IAsyncFreezableIsolationModeVaultFactory.FreezeType.Withdrawal,
                /* _amountDeltaWei = */ IDolomiteStructs.Wei({
                    sign: true,
                    value: _inputAmount
                }),
                _outputToken
            );
        }
    }
}
