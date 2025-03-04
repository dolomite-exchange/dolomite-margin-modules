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
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IPOLIsolationModeTokenVaultV1 } from "./interfaces/IPOLIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGenericTraderProxyV1 } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";


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
        if (dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation( marketId(), _from )) { /* FOR COVERAGE TESTING */ }
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

    function prepareForLiquidation(uint256 _amount) external onlyLiquidator(msg.sender) {
        _unstakeBeforeUnwrapping(_amount);
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
        if (_marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_marketIdsPath[0] == factoryMarketId) {
            _unstakeBeforeUnwrapping(_inputAmountWei);
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
        if (_marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_marketIdsPath[0] == factoryMarketId) {
            _unstakeBeforeUnwrapping(_inputAmountWei);
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
        if (_params.marketIdsPath[0] != _params.marketIdsPath[_params.marketIdsPath.length - 1]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _params.marketIdsPath[0] != _params.marketIdsPath[_params.marketIdsPath.length - 1],
            _FILE,
            "Cannot swap between same market"
        );

        if (_params.marketIdsPath[0] == factoryMarketId) {
            _unstakeBeforeUnwrapping(_params.inputAmountWei);
            super._swapExactInputForOutput(_params);
        } else if (_params.marketIdsPath[_params.marketIdsPath.length - 1] == factoryMarketId) {
            super._swapExactInputForOutput(_params);
            _stakeAfterWrapping();
        } else {
            super._swapExactInputForOutput(_params);
        }
    }

    function _unstakeBeforeUnwrapping(uint256 _amountWei) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );

        // @audit check par values are handled correctly everywhere
        _amountWei = _amountWei == type(uint256).max ? underlyingBalanceOf() : _amountWei;
        uint256 bal = IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault));
        if (_amountWei > bal) {
            _unstake(UNDERLYING_TOKEN(), defaultType, _amountWei - bal);
        }
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

    function _unstake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 _amount) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.unstakeDolomiteToken(_asset, _type, _amount);
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
        metaVault.exit(_asset, true);
    }

}
