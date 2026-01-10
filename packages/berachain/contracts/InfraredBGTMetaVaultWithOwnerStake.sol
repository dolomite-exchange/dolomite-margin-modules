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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { InfraredBGTMetaVault } from "./InfraredBGTMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   InfraredBGTMetaVaultWithOwnerStake
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the underlying berachain rewards
 *          tokens that can be used to credit a user's Dolomite balance. Tokens held in the vault are considered
 *          to be in isolation mode - that is it cannot be borrowed by other users, may only be seized via
 *          liquidation, and cannot be held in the same position as other "isolated" tokens.
 */
contract InfraredBGTMetaVaultWithOwnerStake is InfraredBGTMetaVault, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "InfraredBGTMetaVaultOwnerStake";

    constructor(
        address _ir,
        address _irClaimer,
        address _handler,
        address _dolomiteMargin
    ) InfraredBGTMetaVault(_ir, _irClaimer, _handler) OnlyDolomiteMargin(_dolomiteMargin) {}

    function ownerStakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _stake(_asset, _type, _amount, true);
    }
}
