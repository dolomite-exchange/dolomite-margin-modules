// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { IDepositWithdrawalRouter } from "@dolomite-exchange/modules-base/contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   AdminClaimExcessTokens
 * @author  Dolomite
 *
 * @notice  AdminClaimExcessTokens contract that enables an admin to claim excess tokens from the protocol
 */
contract AdminClaimExcessTokens is Ownable, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    bytes32 private constant _FILE = "AdminClaimExcessTokens";

    IDepositWithdrawalRouter public immutable DEPOSIT_WITHDRAWAL_ROUTER;

    constructor(
        address _gnosisSafe,
        address _depositWithdrawalRouter,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _transferOwnership(_gnosisSafe);

        DEPOSIT_WITHDRAWAL_ROUTER = IDepositWithdrawalRouter(_depositWithdrawalRouter);
    }

    function claimExcessTokens(address _token, address _recipient) external onlyOwner {
        Require.that(
            _recipient == address(this) || _recipient == DOLOMITE_MARGIN_OWNER(),
            _FILE,
            "Invalid recipient"
        );

        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerWithdrawExcessTokens.selector,
                marketId,
                _recipient
            )
        );

        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (_recipient == address(this)) {
            IERC20(_token).safeTransfer(
                owner(),
                balance
            );
        } else if (_recipient == DOLOMITE_MARGIN_OWNER()) {
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                _token,
                abi.encodeWithSelector(
                    IERC20.approve.selector,
                    address(DEPOSIT_WITHDRAWAL_ROUTER),
                    balance
                )
            );
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                address(DEPOSIT_WITHDRAWAL_ROUTER),
                abi.encodeWithSelector(
                    IDepositWithdrawalRouter.depositWei.selector,
                    /* isolationModeMarketId */ 0,
                    /* toAccountNumber */ 0,
                    marketId,
                    balance,
                    /* eventFlag */ 0
                )
            );
        } else {
            revert("Invalid recipient");
        }
    }
}