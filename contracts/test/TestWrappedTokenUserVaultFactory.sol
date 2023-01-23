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

import { WrappedTokenUserVaultFactory } from  "../external/proxies/WrappedTokenUserVaultFactory.sol";


contract TestWrappedTokenUserVaultFactory is WrappedTokenUserVaultFactory {

    uint256[] private _allowablePositionMarketIds;

    constructor(
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    ) WrappedTokenUserVaultFactory(
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setAllowablePositionMarketIds(uint256[] memory __allowablePositionMarketIds) external {
        _allowablePositionMarketIds = __allowablePositionMarketIds;
    }

    function allowablePositionMarketIds() external view override returns (uint256[] memory) {
        return _allowablePositionMarketIds;
    }

    function enqueueTransfer(
        address _from,
        address _to,
        uint256 _amount,
        address _vault
    ) external {
        _cursorToQueuedTransferMap[transferCursor] = QueuedTransfer({
            from: _from,
            to: _to,
            amount: _amount,
            vault: _vault
        });
    }
}
