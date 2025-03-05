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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IGenericTraderProxyV1 } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderProxyV1.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IPOLIsolationModeTokenVaultV1 } from "./interfaces/IPOLIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   POLIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds a Berachain underlying reward
 *          token that can be used to credit a user's Dolomite balance. The token held in the vault is considered
 *          to be in isolation mode - that is it cannot be borrowed by other users, may only be seized via
 *          liquidation, and cannot be held in the same position as other "isolated" tokens.
 */
contract POLIsolationModeTokenVaultV1 is
    IPOLIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "POLIsolationModeTokenVaultV1";

    // ==================================================================
    // ========================= Modifiers ==============================
    // ==================================================================

    modifier onlyLiquidator(address _from) {
        // @audit Should we confirm that there is more than 1 liquidator set? If not anybody can call this
        Require.that(
            dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(
                marketId(),
                _from
            ),
            _FILE,
            "Only liquidator can call",
            _from
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stake(
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyVaultOwner(msg.sender) {
        _stake(UNDERLYING_TOKEN(), _type, _amount);
    }

    function unstake(
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyVaultOwner(msg.sender) {
        _unstake(UNDERLYING_TOKEN(), _type, _amount);
    }

    function getReward() external onlyVaultOwner(msg.sender) {
        _getReward();
    }

    function exit() external onlyVaultOwner(msg.sender) {
        _exit(UNDERLYING_TOKEN());
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        // NO-OP
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        // NO-OP
    }

    function prepareForLiquidation(
        uint256 _accountNumber,
        uint256 _amount
    ) external onlyLiquidator(msg.sender) returns (uint256) {
        return _unstakeBeforeUnwrapping(_accountNumber, _amount);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function underlyingBalanceOf()
        public
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        view
        returns (uint256)
    {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault)) + metaVault.getStakedBalanceByAssetAndType(UNDERLYING_TOKEN(), defaultType);
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsIsolationModeVaultFactory(VAULT_FACTORY()).berachainRewardsRegistry();
    }

    function dolomiteRegistry()
        public
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal override {
        revert("Not implemented");
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal override {
        revert("Not implemented");
    }

    // @audit May need to adjust account number checks because we are wrapping not depositing
    // @note fine to have the 3 functions like this
    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) internal override {
        uint256 factoryMarketId = marketId();
        Require.that(
            _marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_marketIdsPath[0] == factoryMarketId) {
            // @follow-up Check if this is even possible
            _inputAmountWei = _unstakeBeforeUnwrapping(_borrowAccountNumber, _inputAmountWei);
            super._addCollateralAndSwapExactInputForOutput(
                _fromAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
        } else if (_marketIdsPath[_marketIdsPath.length - 1] == factoryMarketId) {
            super._addCollateralAndSwapExactInputForOutput(
                _fromAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
            _stakeAfterWrapping();
        } else {
            super._addCollateralAndSwapExactInputForOutput(
                _fromAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
        }
    }

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
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
        uint256 factoryMarketId = marketId();
        Require.that(
            _marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_marketIdsPath[0] == factoryMarketId) {
            _inputAmountWei = _unstakeBeforeUnwrapping(_borrowAccountNumber, _inputAmountWei);
            super._swapExactInputForOutputAndRemoveCollateral(
                _toAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
        } else if (_marketIdsPath[_marketIdsPath.length - 1] == factoryMarketId) {
            super._swapExactInputForOutputAndRemoveCollateral(
                _toAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
            _stakeAfterWrapping();
        } else {
            super._swapExactInputForOutputAndRemoveCollateral(
                _toAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig
            );
        }
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
        internal
        override
    {
        uint256 factoryMarketId = marketId();
        Require.that(
            _params.marketIdsPath[0] != _params.marketIdsPath[_params.marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_params.marketIdsPath[0] == factoryMarketId) {
            _params.inputAmountWei = _unstakeBeforeUnwrapping(_params.tradeAccountNumber, _params.inputAmountWei);
            super._swapExactInputForOutput(_params);
        } else if (_params.marketIdsPath[_params.marketIdsPath.length - 1] == factoryMarketId) {
            super._swapExactInputForOutput(_params);
            _stakeAfterWrapping();
        } else {
            super._swapExactInputForOutput(_params);
        }
    }

    function _unstakeBeforeUnwrapping(uint256 _accountNumber, uint256 _amountWei) internal returns (uint256) {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );

        // @audit check par values are handled correctly everywhere
        IDolomiteStructs.AccountInfo memory info = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _accountNumber
        });
        IDolomiteStructs.Wei memory accountWei = DOLOMITE_MARGIN().getAccountWei(
            info,
            marketId()
        );

        // @follow-up @Corey, double check this code
        assert(accountWei.sign);
        uint256 bal = IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault));
        if (_amountWei == type(uint256).max) {
            if (accountWei.value > bal) {
                uint256 feeAmount = _unstake(UNDERLYING_TOKEN(), defaultType, accountWei.value - bal);
                IIsolationModeVaultFactory(VAULT_FACTORY()).withdrawFromDolomiteMargin(_accountNumber, feeAmount);
            }
        } else {
            Require.that(
                _amountWei <= accountWei.value,
                _FILE,
                "Insufficient balance"
            );
            if (_amountWei > bal) {
                uint256 feeAmount = _unstake(UNDERLYING_TOKEN(), defaultType, _amountWei - bal);
                IIsolationModeVaultFactory(VAULT_FACTORY()).withdrawFromDolomiteMargin(_accountNumber, feeAmount);
                _amountWei -= feeAmount;
            }
        }

        return _amountWei;
    }

    function _stakeAfterWrapping() internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );

        uint256 bal = IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault));
        _stake(UNDERLYING_TOKEN(), defaultType, bal);
    }

    function _stake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 _amount) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.stakeDolomiteToken(_asset, _type, _amount);
    }

    function _unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) internal returns (uint256) {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        return metaVault.unstakeDolomiteToken(_asset, _type, _amount, true);
    }

    function _getReward() internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.getReward(UNDERLYING_TOKEN());
    }

    function _exit(address _asset) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.exit(_asset, true, true);
    }
}
