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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IAdminClaimExcessTokens } from "./interfaces/IAdminClaimExcessTokens.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminClaimExcessTokens
 * @author  Dolomite
 *
 * @notice  AdminClaimExcessTokens contract that enables an admin to claim excess tokens from the protocol
 */
contract AdminClaimExcessTokens is OnlyDolomiteMargin, IAdminClaimExcessTokens {
    using SafeERC20 for IERC20;

    bytes32 private constant _FILE = "AdminClaimExcessTokens";

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function claimExcessTokens(address _token, bool _depositIntoDolomite) external {
        address treasury = DOLOMITE_REGISTRY.treasury();
        Require.that(
            msg.sender == treasury,
            _FILE,
            "Sender is not treasury"
        );

        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerWithdrawExcessTokens.selector,
                marketId,
                _depositIntoDolomite ? address(this) : treasury
            )
        );

        if (_depositIntoDolomite) {
            uint256 balance = IERC20(_token).balanceOf(address(this));
            IERC20(_token).safeApprove(address(DOLOMITE_MARGIN()), balance);
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                /* accountOwner = */ treasury,
                /* fromAccount = */ address(this),
                /* toAccountNumber = */ 0,
                marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: balance
                })
            );
        }
    }
}