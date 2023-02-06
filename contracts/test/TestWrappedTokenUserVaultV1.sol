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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IWrappedTokenUserVaultFactory } from  "../external/interfaces/IWrappedTokenUserVaultFactory.sol";

import { WrappedTokenUserVaultV1 } from  "../external/proxies/WrappedTokenUserVaultV1.sol";


contract TestWrappedTokenUserVaultV1 is WrappedTokenUserVaultV1 {
    using SafeERC20 for IERC20;

    function callDepositRewardTokenIntoDolomiteMarginForVaultOwner(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    ) external {
        IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId)).safeApprove(address(DOLOMITE_MARGIN()), _amountWei);

        IWrappedTokenUserVaultFactory(VAULT_FACTORY()).depositRewardTokenIntoDolomiteMarginForVaultOwner(
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

    function enqueueTestTransfer(uint256 _transferAmount) external {
        _cursorToQueuedTransferAmountMap[transferCursor] = _transferAmount;
    }
}
