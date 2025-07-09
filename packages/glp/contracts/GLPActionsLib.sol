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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";


/**
 * @title   GLPActionsLib
 * @author  Dolomite
 *
 * @notice  A library contract that contains helper functions for common math that GLP code needs to perform.
 */
library GLPActionsLib {
    using SafeERC20 for IERC20;

    // ===========================================================
    // ======================== Constants ========================
    // ===========================================================

    bytes32 private constant _FILE = "GLPActionsLib";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    function approveGmxForStaking(IERC20 _gmx, address _sGmx, uint256 _amount) public {
        uint256 allowance = _gmx.allowance(address(this), _sGmx);
        if (_amount > 0 && allowance > 0) {
            // reset the allowance to 0 if the approval is greater than zero and there is a non-zero allowance
            _gmx.safeApprove(_sGmx, 0);
        }

        _gmx.safeApprove(_sGmx, _amount);
    }

    function depositIntoGMXVault(
        IGLPIsolationModeTokenVaultV2 _vault,
        address _gmxVault,
        uint256 _accountNumber,
        uint256 _amountWei,
        bool _shouldSkipTransfer
    ) public {
        if (_amountWei == 0) {
            return;
        }

        if (!_shouldSkipTransfer) {
            _vault.gmx().safeApprove(_gmxVault, _amountWei);
        }
        _vault.registry().gmxVaultFactory().executeDepositIntoVaultFromGLPVault(
            _gmxVault,
            _accountNumber,
            _amountWei,
            _shouldSkipTransfer
        );
    }

    function handleRewards(
        IGLPIsolationModeTokenVaultV2 _vault,
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    ) public {
        address gmxVault = _vault.getGmxVaultOrCreate();
        Require.that(
            (!_shouldClaimWeth && !_shouldDepositWethIntoDolomite) || _shouldClaimWeth,
            _FILE,
            "Can only deposit ETH if claiming"
        );
        Require.that(
            !(!_shouldClaimGmx && _shouldStakeGmx),
            _FILE,
            "Can only stake GMX if claiming"
        );

        if (_shouldStakeGmx) {
            // we don't know how much GMX will be staked, so we have to approve all
            approveGmxForStaking(_vault.gmx(), address(_vault.sGmx()), type(uint256).max);
        }

        uint256 stakedGmxBalanceBefore = _vault.gmxBalanceOf();
        _vault.gmxRewardsRouter().handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            /* _shouldConvertWethToEth = */ false
        );
        uint256 stakedGmxBalanceDelta = _vault.gmxBalanceOf() - stakedGmxBalanceBefore;

        if (_shouldStakeGmx) {
            // we can reset the allowance back to 0 here
            approveGmxForStaking(_vault.gmx(), address(_vault.sGmx()), /* _amount = */ 0);
        }

        if (_shouldClaimGmx) {
            _claimGmx(_vault, gmxVault, stakedGmxBalanceDelta);
        }

        if (_shouldClaimWeth) {
            _claimWeth(_vault, _shouldDepositWethIntoDolomite, _depositAccountNumberForWeth);
        }
    }

    function _claimGmx(
        IGLPIsolationModeTokenVaultV2 _vault,
        address _gmxVault,
        uint256 _stakedGmxBalanceDelta
    ) private {
        uint256 unstakedGmxBalance = _vault.gmx().balanceOf(address(this));
        _vault.gmx().safeApprove(address(_vault.DOLOMITE_MARGIN()), unstakedGmxBalance);
        IGLPIsolationModeVaultFactory(_vault.VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
            _DEFAULT_ACCOUNT_NUMBER,
            _vault.DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_vault.gmx())),
            unstakedGmxBalance
        );
        depositIntoGMXVault(
            _vault,
            _gmxVault,
            _DEFAULT_ACCOUNT_NUMBER,
            _stakedGmxBalanceDelta,
            /* shouldSkipTransfer = */ true
        );
    }

    function _claimWeth(
        IGLPIsolationModeTokenVaultV2 _vault,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    ) private {
        address factory = _vault.VAULT_FACTORY();
        address weth = IGLPIsolationModeVaultFactory(factory).WETH();
        uint256 wethAmountWei = IERC20(weth).balanceOf(address(this));
        if (_shouldDepositWethIntoDolomite) {
            IERC20(weth).safeApprove(address(_vault.DOLOMITE_MARGIN()), wethAmountWei);
            IGLPIsolationModeVaultFactory(factory).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                _depositAccountNumberForWeth,
                IGLPIsolationModeVaultFactory(factory).WETH_MARKET_ID(),
                wethAmountWei
            );
        } else {
            IERC20(weth).safeTransfer(msg.sender, wethAmountWei);
        }
    }
}
