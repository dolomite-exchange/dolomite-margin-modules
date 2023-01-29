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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginCallee } from "../../protocol/interfaces/IDolomiteMarginCallee.sol";
import { IDolomiteMarginLiquidationCallback } from "../../protocol/interfaces/IDolomiteMarginLiquidationCallback.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { WrappedTokenUserVaultV1 } from "../proxies/WrappedTokenUserVaultV1.sol";

import { IBorrowPositionProxyV2 } from "../interfaces/IBorrowPositionProxyV2.sol";
import { IGLPRewardRouterV2 } from"../interfaces/IGLPRewardRouterV2.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   GLPWrappedTokenUserVault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPWrappedTokenUserVault is WrappedTokenUserVaultV1 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrappedTokenUserVault";

    // ============ External Functions ============

    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositEthIntoDolomite
    )
    external
    onlyVaultOwner(msg.sender) {
        GLP_REWARDS_ROUTER().handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            /* _shouldConvertWethToEth = */ false
        );

        address factory = VAULT_FACTORY();
        if (!_shouldStakeGmx) {
            // If the user isn't staking GMX, transfer it to the vault owner
            IERC20 GMX = IERC20(IGLPWrappedTokenUserVaultFactory(factory).GMX());
            uint amount = GMX.balanceOf(address(this));
            GMX.safeTransfer(msg.sender, amount);
        }

        if (!_shouldStakeEsGmx) {
            // If the user isn't staking esGMX, transfer it to the vault owner
            IERC20 ES_GMX = IERC20(IGLPWrappedTokenUserVaultFactory(factory).ES_GMX());
            uint amount = ES_GMX.balanceOf(address(this));
            ES_GMX.safeTransfer(msg.sender, amount);
        }

        if (_shouldClaimWeth) {
            address weth = IGLPWrappedTokenUserVaultFactory(factory).WETH();
            uint256 amountWei = IERC20(weth).balanceOf(address(this));
            if (_shouldDepositEthIntoDolomite) {
                IERC20(weth).safeApprove(DOLOMITE_MARGIN(), amountWei);
                IWrappedTokenUserVaultFactory(factory).depositRewardTokenIntoDolomiteMarginForVaultOwner(
                    /* _toAccountNumber = */ 0,
                    IGLPWrappedTokenUserVaultFactory(factory).WETH_MARKET_ID(),
                    amountWei
                );
            } else {
                IERC20(weth).safeTransfer(msg.sender, amountWei);
            }
        }
    }

    function GLP_REWARDS_ROUTER() public view returns (IGLPRewardRouterV2) {
        return IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).glpRewardsRouter();
    }

    // TODO: add stake/unstake esGMX
    // TODO: add vesting deposit/withdraw esGMX
}
