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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";
import { IGLPWrappedTokenUserVaultV1 } from "../interfaces/IGLPWrappedTokenUserVaultV1.sol";
import { IGmxRewardRouterV2 } from "../interfaces/IGmxRewardRouterV2.sol";
import { IGmxVester } from "../interfaces/IGmxVester.sol";
import { ISGMX } from "../interfaces/ISGMX.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
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
    bytes32 private constant _HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.hasAcceptedFullAccountTransfer")) - 1);

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
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    )
    external
    override
    nonReentrant
    onlyVaultOwner(msg.sender) {
        if ((!_shouldClaimWeth && !_shouldDepositWethIntoDolomite) || _shouldClaimWeth) { /* FOR COVERAGE TESTING */ }
        Require.that((!_shouldClaimWeth && !_shouldDepositWethIntoDolomite) || _shouldClaimWeth,
            _FILE,
            "Can only deposit ETH if claiming"
        );

        if (_shouldStakeGmx) {
            // we don't know how much GMX will be staked, so we have to approve all
            _approveGmxForStaking(gmx(), type(uint256).max);
        }
        gmxRewardsRouter().handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            /* _shouldConvertWethToEth = */ false
        );

        if (_shouldStakeGmx) {
            // we can reset the allowance back to 0 here
            _approveGmxForStaking(gmx(), 0);
        } else {
            // If the user isn't staking GMX, transfer it to the vault owner
            _withdrawAllGmx(msg.sender);
        }

        if (_shouldClaimWeth) {
            address factory = VAULT_FACTORY();
            address weth = IGLPWrappedTokenUserVaultFactory(factory).WETH();
            uint256 wethAmountWei = IERC20(weth).balanceOf(address(this));
            if (_shouldDepositWethIntoDolomite) {
                IERC20(weth).safeApprove(address(DOLOMITE_MARGIN()), wethAmountWei);
                IWrappedTokenUserVaultFactory(factory).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                    _depositAccountNumberForWeth,
                    IGLPWrappedTokenUserVaultFactory(factory).WETH_MARKET_ID(),
                    wethAmountWei
                );
            } else {
                IERC20(weth).safeTransfer(msg.sender, wethAmountWei);
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
        if (_sender != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_sender != address(0),
            _FILE,
            "Invalid sender"
        );
        if (!hasAcceptedFullAccountTransfer() && underlyingBalanceOf() == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(!hasAcceptedFullAccountTransfer() && underlyingBalanceOf() == 0,
            _FILE,
            "Cannot transfer more than once"
        );

        gmxRewardsRouter().acceptTransfer(_sender);

        // set this flag so we don't materialize the transfer. This is needed because the assets are spot settled in
        // this vault via the call to #acceptTransfer
        _setIsAcceptingFullAccountTransfer(true);

        // the amount of fsGLP being deposited is the current balance of fsGLP, since we should have started at 0.
        uint amountWei = underlyingBalanceOf();
        IWrappedTokenUserVaultFactory(VAULT_FACTORY()).depositIntoDolomiteMargin(/* _toAccountNumber = */ 0, amountWei);

        // reset the flag back to false
        _setIsAcceptingFullAccountTransfer(false);

        // set this flag so we don't allow full account transfers again
        _setHasAcceptedFullAccountTransfer(true);
    }

    function vestGlp(uint256 _esGmxAmount) external override onlyVaultOwner(msg.sender) {
        _vestEsGmx(vGlp(), _esGmxAmount);
    }

    function unvestGlp(bool _shouldStakeGmx) external override onlyVaultOwner(msg.sender) {
        _unvestEsGmx(vGlp(), _shouldStakeGmx);
    }

    function vestGmx(uint256 _esGmxAmount) external override onlyVaultOwner(msg.sender) {
        _vestEsGmx(vGmx(), _esGmxAmount);
    }

    function unvestGmx(bool _shouldStakeGmx) external override onlyVaultOwner(msg.sender) {
        _unvestEsGmx(vGmx(), _shouldStakeGmx);
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
            /*assert(_amount == underlyingBalanceOf());*/
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

        /*assert(_recipient != address(this));*/
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

    function hasAcceptedFullAccountTransfer() public view returns (bool) {
        return _getUint256(_HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT) == 1;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _stakeGmx(IERC20 _gmx, uint256 _amount) internal {
        _approveGmxForStaking(_gmx, _amount);
        gmxRewardsRouter().stakeGmx(_amount);
    }

    function _vestEsGmx(IGmxVester _vester, uint256 _esGmxAmount) internal {
        _vester.deposit(_esGmxAmount);
    }

    function _unvestEsGmx(IGmxVester _vester, bool _shouldStakeGmx) internal {
        _vester.withdraw();
        if (_shouldStakeGmx) {
            IERC20 _gmx = gmx();
            _stakeGmx(_gmx, _gmx.balanceOf(address(this)));
        } else {
            _withdrawAllGmx(msg.sender);
        }
    }

    function _approveGmxForStaking(IERC20 _gmx, uint256 _amount) internal {
        address _sGmx = address(sGmx());
        uint256 allowance = _gmx.allowance(address(this), _sGmx);
        if (_amount > 0 && allowance > 0) {
            // reset the allowance to 0 if the approval is greater than zero and there is a non-zero allowance
            _gmx.safeApprove(_sGmx, 0);
        }

        _gmx.safeApprove(_sGmx, _amount);
    }

    function _withdrawAllGmx(address _recipient) internal {
        IERC20 _gmx = gmx();
        _gmx.safeTransfer(_recipient, _gmx.balanceOf(address(this)));
    }

    function _setIsAcceptingFullAccountTransfer(bool _isAcceptingFullAccountTransfer) internal {
        _setUint256(_IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT, _isAcceptingFullAccountTransfer ? 1 : 0);
    }

    function _setHasAcceptedFullAccountTransfer(bool _hasAcceptingFullAccountTransfer) internal {
        _setUint256(_HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT, _hasAcceptingFullAccountTransfer ? 1 : 0);
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
