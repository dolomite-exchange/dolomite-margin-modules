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
import { IGmxRewardRouterV2 } from"../interfaces/IGmxRewardRouterV2.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";
import { IGmxVester } from "../interfaces/IGmxVester.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   GLPWrappedTokenUserVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPWrappedTokenUserVaultV1 is WrappedTokenUserVaultV1 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrappedTokenUserVaultV1";

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
        gmxRewardsRouter().handleRewards(
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
            IERC20 _gmx = gmx();
            uint amount = _gmx.balanceOf(address(this));
            _gmx.safeTransfer(msg.sender, amount);
        }

        if (_shouldClaimWeth) {
            address weth = IGLPWrappedTokenUserVaultFactory(factory).WETH();
            uint256 amountWei = IERC20(weth).balanceOf(address(this));
            if (_shouldDepositEthIntoDolomite) {
                IERC20(weth).safeApprove(address(DOLOMITE_MARGIN()), amountWei);
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

    function stakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        IERC20 _gmx = gmx();
        _gmx.safeTransferFrom(msg.sender, address(this), _amount);

        IGmxRewardRouterV2 _gmxRewardsRouter = gmxRewardsRouter();
        _gmx.safeApprove(address(_gmxRewardsRouter), _amount);
        _gmxRewardsRouter.stakeGmx(_amount);
    }

    function unstakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeGmx(_amount);

        gmx().safeTransfer(msg.sender, _amount);
    }

    function stakeEsGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().stakeEsGmx(_amount);
    }

    function unstakeEsGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeEsGmx(_amount);
    }

    function acceptFullAccountTransfer(address _sender) external onlyVaultOwner(msg.sender) nonReentrant {
        gmxRewardsRouter().acceptTransfer(_sender);
        // TODO: deposit received assets into Dolomite
    }

    function vestGlp(uint256 _amount) external onlyVaultOwner(msg.sender) {
        vGlp().deposit(_amount);
    }

    function unvestGlp() external onlyVaultOwner(msg.sender) {
        vGlp().withdraw();
    }

    function vestGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        vGmx().deposit(_amount);
    }

    function unvestGmx() external onlyVaultOwner(msg.sender) {
        vGmx().withdraw();
    }

    // ============ Public Functions ============

    function executeDepositIntoVault(
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        sGlp().safeTransferFrom(_proxySelf().owner(), address(this), _amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (super.underlyingBalanceOf() < _amount) {
            // There's not enough value in the vault to cover the withdrawal, so we need to withdraw from the vGLP
            vGlp().withdraw();
        }

        assert(_recipient != address(this));
        sGlp().safeTransfer(_recipient, _amount);
    }

    function gmxRewardsRouter() public view returns (IGmxRewardRouterV2) {
        return IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().gmxRewardsRouter();
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        return vGlp().pairAmounts(address(this)) + super.underlyingBalanceOf();
    }

    function gmxBalanceOf() public view returns (uint256) {
        return vGmx().pairAmounts(address(this));
    }

    function gmx() public view returns (IERC20) {
        return IERC20(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().gmx());
    }

    function sGlp() public view returns (IERC20) {
        return IERC20(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().sGlp());
    }

    function vGlp() public view returns (IGmxVester) {
        return IGmxVester(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().vGlp());
    }

    function vGmx() public view returns (IGmxVester) {
        return IGmxVester(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().vGmx());
    }
}
