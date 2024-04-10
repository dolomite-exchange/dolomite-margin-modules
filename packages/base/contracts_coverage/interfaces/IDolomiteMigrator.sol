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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IDolomiteMigrator
 * @author  Dolomite
 *
 * Interface for a migrator contract, which can migrate funds out of users isolation mode vaults
 */
interface IDolomiteMigrator {

    struct Transformer {
        address transformer;
        bool soloAllowable;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event MigrationComplete(
        address indexed _accountOwner,
        uint256 _accountNumber,
        uint256 _fromMarketId,
        uint256 _toMarketId
    );

    event TransformerSet(uint256 _fromMarketId, uint256 _toMarketId, address _transformer);

    event HandlerSet(address _handler);

    // ================================================
    // ================== Functions ===================
    // ================================================

    function migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) external;

    function ownerSetTransformer(uint256 _fromMarketId, uint256 _toMarketId, address _transformer, bool _soloAllowable) external;

    function ownerSetHandler(address _handler) external;
}
