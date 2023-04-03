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

import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";

import { IBorrowPositionProxyV2 } from "../interfaces/IBorrowPositionProxyV2.sol";
import { IGLPWrappedTokenUserVaultV1 } from "../interfaces/IGLPWrappedTokenUserVaultV1.sol";
import { IGmxRewardRouterV2 } from"../interfaces/IGmxRewardRouterV2.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";
import { IGmxVester } from "../interfaces/IGmxVester.sol";
import { ISGMX } from "../interfaces/ISGMX.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultProxy } from "../interfaces/IWrappedTokenUserVaultProxy.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { WrappedTokenUserVaultV1 } from "../proxies/abstract/WrappedTokenUserVaultV1.sol";


/**
 * @title   GLPWrappedTokenUserVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPWrappedTokenUserVaultV1 is IGLPWrappedTokenUserVaultV1, WrappedTokenUserVaultV1, ProxyContractHelpers {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GLPWrappedTokenUserVaultV1";
    bytes32 private constant _IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.isAcceptingFullAccountTransfer")) - 1);

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite
    )
    external
    override
    onlyVaultOwner(msg.sender) {
        _approveGmxForStaking(gmx());
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
            _withdrawAllGmx(msg.sender);
        }

        if (_shouldClaimWeth) {
            address weth = IGLPWrappedTokenUserVaultFactory(factory).WETH();
            uint256 amountWei = IERC20(weth).balanceOf(address(this));
            if (_shouldDepositWethIntoDolomite) {
                IERC20(weth).safeApprove(address(DOLOMITE_MARGIN()), amountWei);
                // TODO: change toAccountNumber to be dynamic as # of listed markets grow.
                IWrappedTokenUserVaultFactory(factory).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                    /* _toAccountNumber = */ 0,
                    IGLPWrappedTokenUserVaultFactory(factory).WETH_MARKET_ID(),
                    amountWei
                );
            } else {
                IERC20(weth).safeTransfer(msg.sender, amountWei);
            }
        }
    }

    function stakeGmx(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        IERC20 _gmx = gmx();
        _gmx.safeTransferFrom(msg.sender, address(this), _amount);

        _stakeGmx(_gmx, _amount);
    }

    function unstakeGmx(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeGmx(_amount);

        gmx().safeTransfer(msg.sender, _amount);
    }

    function stakeEsGmx(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().stakeEsGmx(_amount);
    }

    function unstakeEsGmx(uint256 _amount) external override onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeEsGmx(_amount);
    }

    function acceptFullAccountTransfer(
        address _sender
    )
    external
    override
    nonReentrant
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        gmxRewardsRouter().acceptTransfer(_sender);

        // set this flag so we don't materialize the transfer. This is needed because the assets are spot settled in
        // this vault via the call to #acceptTransfer
        _setIsAcceptingFullAccountTransfer(true);

        // the amount of fsGLP being deposited is the current balance of fsGLP, because we started at 0.
        uint amountWei = underlyingBalanceOf();
        IWrappedTokenUserVaultFactory(VAULT_FACTORY()).depositIntoDolomiteMargin(/* _toAccountNumber = */ 0, amountWei);

        // reset the flag back to false
        _setIsAcceptingFullAccountTransfer(false);
    }

    function vestGlp(uint256 _esGmxAmount) external override onlyVaultOwner(msg.sender) {
        vGlp().deposit(_esGmxAmount);
    }

    function unvestGlp(bool _shouldStakeGmx) external override onlyVaultOwner(msg.sender) {
        vGlp().withdraw();
        if (_shouldStakeGmx) {
            IERC20 _gmx = gmx();
            _stakeGmx(_gmx, _gmx.balanceOf(address(this)));
        } else {
            _withdrawAllGmx(msg.sender);
        }
    }

    function vestGmx(uint256 _esGmxAmount) external override onlyVaultOwner(msg.sender) {
        vGmx().deposit(_esGmxAmount);
    }

    function unvestGmx(bool _shouldStakeGmx) external override onlyVaultOwner(msg.sender) {
        vGmx().withdraw();
        if (_shouldStakeGmx) {
            IERC20 _gmx = gmx();
            _stakeGmx(_gmx, _gmx.balanceOf(address(this)));
        } else {
            _withdrawAllGmx(msg.sender);
        }
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (isAcceptingFullAccountTransfer()) {
            // The fsGLP is already in this vault, so don't materialize a transfer from the vault owner
            assert(_amount == underlyingBalanceOf());
        } else {
            sGlp().safeTransferFrom(_from, address(this), _amount);
        }
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (super.underlyingBalanceOf() < _amount) {
            // There's not enough value in the vault to cover the withdrawal, so we need to withdraw from vGLP
            vGlp().withdraw();
            _withdrawAllGmx(_proxySelf().owner());
        }

        assert(_recipient != address(this));
        // we can't use the fsGLP because it's not transferable. sGLP contains the authorization and logic for
        // transferring fsGLP tokens.
        sGlp().safeTransfer(_recipient, _amount);
    }

    function esGmx() public view returns (IERC20) {
        return IERC20(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().esGmx());
    }

    function gmxRewardsRouter() public view returns (IGmxRewardRouterV2) {
        return IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().gmxRewardsRouter();
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        return vGlp().pairAmounts(address(this)) + super.underlyingBalanceOf();
    }

    function gmxBalanceOf() public view returns (uint256) {
        address account = address(this);
        // sGmx reflects the amount of GMX tokens the user owns. The `depositBalances` mapping isn't updated when the
        // sbfGMX tokens are transferred to the vGMX vesting contract, so this seems reliable. Moreover, this contract
        // only holds staked-GMX tokens, which is why we only check the sGMX contract. sGMX reflects any sbfGMX that is
        // moved into vGMX vesting too.
        return sGmx().depositBalances(account, address(gmx()));
    }

    function esGmxBalanceOf() public view returns (uint256) {
        IERC20 _esGmx = esGmx();
        address account = address(this);
        // We need to pull the esGMX being held here, in the vesting contracts for GMX and GLP, and being staked in the
        // sGMX contract
        return _esGmx.balanceOf(account)
            + vGmx().balanceOf(account)
            + vGlp().balanceOf(account)
            + sGmx().depositBalances(account, address(_esGmx));
    }

    function getGlpAmountNeededForEsGmxVesting(uint256 _esGmxAmount) public view returns (uint256) {
        return _getPairAmountNeededForEsGmxVesting(vGlp(), _esGmxAmount);
    }

    function getGmxAmountNeededForEsGmxVesting(uint256 _esGmxAmount) public view returns (uint256) {
        return _getPairAmountNeededForEsGmxVesting(vGmx(), _esGmxAmount);
    }

    function gmx() public view returns (IERC20) {
        return IERC20(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().gmx());
    }

    function sGlp() public view returns (IERC20) {
        return IERC20(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().sGlp());
    }

    function sGmx() public view returns (ISGMX) {
        return ISGMX(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().sGmx());
    }

    function vGlp() public view returns (IGmxVester) {
        return IGmxVester(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().vGlp());
    }

    function vGmx() public view returns (IGmxVester) {
        return IGmxVester(IGLPWrappedTokenUserVaultFactory(VAULT_FACTORY()).gmxRegistry().vGmx());
    }

    function isAcceptingFullAccountTransfer() public view returns (bool) {
        return _getUint256(_IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT) == 1;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _stakeGmx(IERC20 _gmx, uint256 _amount) internal {
        _approveGmxForStaking(_gmx);
        gmxRewardsRouter().stakeGmx(_amount);
    }

    function _approveGmxForStaking(IERC20 _gmx) internal {
        address _sGmx = address(sGmx());
        if (_gmx.allowance(address(this), _sGmx) == 0) {
            _gmx.safeApprove(_sGmx, type(uint256).max);
        }
    }

    function _withdrawAllGmx(address _recipient) internal {
        IERC20 _gmx = gmx();
        _gmx.safeTransfer(_recipient, _gmx.balanceOf(address(this)));
    }

    function _setIsAcceptingFullAccountTransfer(bool _isAcceptingFullAccountTransfer) internal {
        _setUint256(_IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT, _isAcceptingFullAccountTransfer ? 1 : 0);
    }

    function _getPairAmountNeededForEsGmxVesting(
        IGmxVester _vester,
        uint256 _esGmxAmount
    ) internal view returns (uint256) {
        address account = address(this);
        uint256 pairAmount = _vester.pairAmounts(account);
        uint256 nextPairAmount = _vester.getPairAmount(account, _esGmxAmount + _vester.balanceOf(account));
        if (nextPairAmount > pairAmount) {
            return nextPairAmount - pairAmount;
        } else {
            return 0;
        }
    }
}
