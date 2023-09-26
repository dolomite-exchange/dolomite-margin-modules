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

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { IDolomiteRegistry } from "../external/interfaces/IDolomiteRegistry.sol";
import { IIsolationModeUpgradeableProxy } from "../external/interfaces/IIsolationModeUpgradeableProxy.sol";
import { IsolationModeUpgradeableProxy } from "../external/proxies/IsolationModeUpgradeableProxy.sol";
import { IsolationModeVaultFactory } from "../external/proxies/abstract/IsolationModeVaultFactory.sol";


/**
 * @title   TestIsolationModeFactory
 * @author  Dolomite
 *
 * @notice  This contract is used to test the IsolationModeVaultFactory contract.
 */
contract TestIsolationModeFactory is IsolationModeVaultFactory {

    uint256[] private _allowableDebtMarketIds;
    uint256[] private _allowableCollateralMarketIds;
    bool private _shouldSpendAllowance;

    IDolomiteRegistry public dolomiteRegistry;

    constructor(
        address _dolomiteRegistry,
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    ) IsolationModeVaultFactory(
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        dolomiteRegistry = IDolomiteRegistry(_dolomiteRegistry);
        _shouldSpendAllowance = true;
    }

    function testEnqueueTransfer(
        address _from,
        address _to,
        uint256 _amount,
        address _vault
    ) external {
        _cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: _from,
            to: _to,
            amount: _amount,
            vault: _vault,
            isExecuted: false
        });
    }

    function createVaultNoInitialize(
        address _account
    ) external {
        // Deploys the contract without calling #initialize
        address vault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(IsolationModeUpgradeableProxy).creationCode
        );

        _vaultToUserMap[vault] = _account;
        _userToVaultMap[_account] = vault;
    }

    function createVaultWithDifferentAccount(
        address _account1,
        address _account2
    ) external {
        address vault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account1)),
            type(IsolationModeUpgradeableProxy).creationCode
        );

        _vaultToUserMap[vault] = _account1;
        _userToVaultMap[_account1] = vault;
        IIsolationModeUpgradeableProxy(vault).initialize(_account2);
    }

    function setAllowableDebtMarketIds(uint256[] memory __allowableDebtMarketIds) external {
        _allowableDebtMarketIds = __allowableDebtMarketIds;
    }

    function setAllowableCollateralMarketIds(uint256[] memory __allowableCollateralMarketIds) external {
        _allowableCollateralMarketIds = __allowableCollateralMarketIds;
    }

    function setShouldSpendAllowance(bool newShouldSpendAllowance) external {
        _shouldSpendAllowance = newShouldSpendAllowance;
    }

    function allowableDebtMarketIds() external view override returns (uint256[] memory) {
        return _allowableDebtMarketIds;
    }

    function allowableCollateralMarketIds() external view override returns (uint256[] memory) {
        return _allowableCollateralMarketIds;
    }

    // ========================= Internal Functions =========================

    function _spendAllowance(
        address _owner,
        address _spender,
        uint256 _amount
    ) internal override {
        if (_shouldSpendAllowance) {
            super._spendAllowance(_owner, _spender, _amount);
        }
    }
}
