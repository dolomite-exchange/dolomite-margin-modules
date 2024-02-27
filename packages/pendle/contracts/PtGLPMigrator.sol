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
import { DolomiteMigrator } from "@dolomite-exchange/modules-base/contracts/general/DolomiteMigrator.sol";
import { IIsolationModeMigrator } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeMigrator.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGLPIsolationModeVaultFactory } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGLPIsolationModeVaultFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// solhint-enable max-line-length


/**
 * @title   PtGLPMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for converting PtGLP to GLP
 */
contract PtGLPMigrator is DolomiteMigrator {
    using SafeERC20 for IERC20;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "PtGLPMigrator";

    constructor(
        address _dolomiteMargin,
        address _handler
    ) DolomiteMigrator(_dolomiteMargin, _handler) {}

    // ================================================
    // =================== Functions ==================
    // ================================================

    function _migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) internal override {
        Require.that(
            _fromMarketId != _toMarketId,
            _FILE,
            "Cannot migrate to same market"
        );
        Require.that(
            _isIsolationModeMarket(_fromMarketId) && _isIsolationModeMarket(_toMarketId),
            _FILE,
            "Markets must be isolation mode"
        );

        IIsolationModeVaultFactory fromFactory = IIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_fromMarketId)
        );
        IGLPIsolationModeVaultFactory toFactory = IGLPIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_toMarketId)
        );

        for (uint256 i; i < _accounts.length; ++i) {
            IDolomiteStructs.AccountInfo memory account = _accounts[i];

            address owner = fromFactory.getAccountByVault(account.owner);
            Require.that(
                owner != address(0),
                _FILE,
                "Invalid vault"
            );
            address toVault = toFactory.getVaultByAccount(owner);
            if (toVault == address(0)) {
                toVault = toFactory.createVault(owner);
            }

            uint256 amountWei = DOLOMITE_MARGIN().getAccountWei(account, _fromMarketId).value;
            IIsolationModeMigrator(account.owner).migrate(amountWei);
            uint256 amountOut = _delegateCallToTransformer(_fromMarketId, _toMarketId, amountWei, _extraData);

            // @follow-up How to handle this override because GLP vault uses sGlp not the underlying token
            // Override the full function like I'm doing here or do something else?
            fromFactory.enqueueTransferFromDolomiteMargin(account.owner, amountWei);
            toFactory.enqueueTransferIntoDolomiteMargin(toVault, amountOut);
            IERC20(toFactory.gmxRegistry().sGlp()).safeApprove(toVault, amountOut);
            IERC20(address(toFactory)).safeApprove(address(DOLOMITE_MARGIN()), amountOut);

            _craftAndExecuteActions(account, toVault, _fromMarketId, _toMarketId, amountOut);
            emit MigrationComplete(account.owner, account.number, _fromMarketId, _toMarketId);
        }
    }
}
