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
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IPendleGLPRegistry } from "../interfaces/pendle/IPendleGLPRegistry.sol";
import { IPendleYtGLP2024IsolationModeTokenVaultV1 } from "../interfaces/pendle/IPendleYtGLP2024IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IPendleYtGLP2024IsolationModeVaultFactory } from "../interfaces/pendle/IPendleYtGLP2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IPendleYtToken } from "../interfaces/pendle/IPendleYtToken.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   PendleYtGLP2024IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the ytGLP (March 2024 expiration)
 *          token that can be used to credit a user's Dolomite balance.
 */
contract PendleYtGLP2024IsolationModeTokenVaultV1 is
    IPendleYtGLP2024IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteMargin.Wei;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendleYtGLP2024UserVaultV1";
    uint256 public constant ONE_WEEK = 1 weeks;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        RewardDeposit[] memory _rewardDeposits
    ) 
    external 
    nonReentrant 
    onlyVaultOwner(msg.sender) 
    {
        _redeemDueInterestAndRewards(
            _redeemInterest,
            _redeemRewards,
            _rewardDeposits
        );
    }

    function registry() public view returns (IPendleGLPRegistry) {
        return IPendleYtGLP2024IsolationModeVaultFactory(VAULT_FACTORY()).pendleGLPRegistry();
    }

    function dolomiteRegistry()
        public
        override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public view override returns (bool) {
        return IPendleYtGLP2024IsolationModeVaultFactory(VAULT_FACTORY()).pendleGLPRegistry().syGlpToken().paused();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _redeemDueInterestAndRewards(
        bool _redeemInterest,
        bool _redeemRewards,
        RewardDeposit[] memory _rewardDeposits
    ) internal {
        IPendleYtToken(UNDERLYING_TOKEN()).redeemDueInterestAndRewards(
                address(this),
                _redeemInterest,
                _redeemRewards
            );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        address factory = VAULT_FACTORY();

        for (uint256 i; i < _rewardDeposits.length; i++) {
            address token = _rewardDeposits[i].token;
            uint256 amount = IERC20(token).balanceOf(address(this));

            if (_rewardDeposits[i].depositIntoDolomite) {
                IERC20(token).safeApprove(address(dolomiteMargin), amount);
                uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(token);
                IIsolationModeVaultFactory(factory).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                    /* _toAccountNumber = */ 0,
                    marketId,
                    amount
                );
            }
            else {
                IERC20(token).safeTransfer(msg.sender, amount);
            }
        }
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal override
    {
        uint256 ytMaturityTimestamp = IPendleYtGLP2024IsolationModeVaultFactory(VAULT_FACTORY()).ytMaturityTimestamp();
        Require.that(
            block.timestamp + ONE_WEEK < ytMaturityTimestamp,
            _FILE,
            "Too close to expiry"
        );

        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
        internal
        override
    {
        IPendleYtGLP2024IsolationModeVaultFactory vaultFactory = IPendleYtGLP2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        );
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo(
            address(this),
            _tradeAccountNumber
        );
        IDolomiteStructs.Wei memory balanceAfterWei = _getBalanceAfterWei(accountInfo, _marketIdsPath[0], _inputAmountWei, vaultFactory);

        // check if balanceAfterWei is negative and it is within 1 week of expiry. If so, revert
        uint256 ytMaturityTimestamp = vaultFactory.ytMaturityTimestamp();
        Require.that(
            block.timestamp + ONE_WEEK < ytMaturityTimestamp || balanceAfterWei.isPositive() || balanceAfterWei.isZero(),
            _FILE,
            "Too close to expiry"
        );

        super._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );

        // if account balance is negative, set expiry
        if (balanceAfterWei.isNegative()) {
            _setExpirationForBorrowPosition(accountInfo, _marketIdsPath[0], ytMaturityTimestamp, vaultFactory);
        }
    }


    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal override {
        IPendleYtGLP2024IsolationModeVaultFactory vaultFactory = IPendleYtGLP2024IsolationModeVaultFactory(
            VAULT_FACTORY()
        );
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo(
            address(this),
            _borrowAccountNumber
        );
        IDolomiteStructs.Wei memory balanceAfterWei = _getBalanceAfterWei(accountInfo, _marketId, _amountWei, vaultFactory);

        // check if balanceAfterWei is negative and it is within 1 week of expiry. If so, revert
        uint256 ytMaturityTimestamp = vaultFactory.ytMaturityTimestamp();
        Require.that(
            block.timestamp + ONE_WEEK < ytMaturityTimestamp || balanceAfterWei.isPositive() || balanceAfterWei.isZero(),
            _FILE,
            "Too close to expiry"
        );

        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        // if account balance is negative, set expiry
        if (balanceAfterWei.isNegative()) {
            _setExpirationForBorrowPosition(accountInfo, _marketId, ytMaturityTimestamp, vaultFactory);
        }
    }

    function _checkExistingBorrowPositions(
        IDolomiteStructs.AccountInfo memory info
    ) internal view returns (uint256) {
        IPendleYtGLP2024IsolationModeVaultFactory vaultFactory = IPendleYtGLP2024IsolationModeVaultFactory(VAULT_FACTORY());
        IExpiry expiry = vaultFactory.pendleGLPRegistry().dolomiteRegistry().expiry();

        uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
        uint256 allowableDebtMarketIdsLength = allowableDebtMarketIds.length;
        uint256 existingExpiry;

        for (uint256 i = 0; i < allowableDebtMarketIdsLength; ++i) {
            existingExpiry = expiry.getExpiry(info, allowableDebtMarketIds[i]);
            if (existingExpiry != 0) {
                return existingExpiry - block.timestamp;
            }
        }

        return 0;
    }

    function _setExpirationForBorrowPosition(IDolomiteStructs.AccountInfo memory _accountInfo, uint256 _marketId, uint256 _ytMaturityTimestamp, IPendleYtGLP2024IsolationModeVaultFactory vaultFactory) internal {
        uint256 expiryDelta = _checkExistingBorrowPositions(_accountInfo);
        if (expiryDelta == 0) {
            // If an expiry doesn't exist, use the min of 4 weeks or the time until 1-week before YT's expiration
            expiryDelta = Math.min(4 * ONE_WEEK, _ytMaturityTimestamp - ONE_WEEK - block.timestamp);
        }

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[0] = _accountInfo;

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
        actions[0] = AccountActionLib.encodeExpirationAction(
            accounts[0],
            /* _accountId = */ 0,
            _marketId,
            address(vaultFactory.pendleGLPRegistry().dolomiteRegistry().expiry()),
            expiryDelta
        );

        vaultFactory.DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _getBalanceAfterWei(IDolomiteStructs.AccountInfo memory _accountInfo, uint256 _marketId, uint256 _inputAmountWei, IPendleYtGLP2024IsolationModeVaultFactory vaultFactory) internal view returns (IDolomiteStructs.Wei memory balanceAfterWei) {
        IDolomiteStructs.Wei memory balanceBeforeWei = vaultFactory.DOLOMITE_MARGIN().getAccountWei(_accountInfo, _marketId);
        IDolomiteStructs.Wei memory deltaWei = IDolomiteStructs.Wei({
            sign: false,
            value: _inputAmountWei
        });
        balanceAfterWei = balanceBeforeWei.add(deltaWei);
    }
}
