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
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGenericTraderProxyV2 } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/IGenericTraderProxyV2.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBaseMetaVault } from "./interfaces/IBaseMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";
import { IPOLIsolationModeTokenVaultV1 } from "./interfaces/IPOLIsolationModeTokenVaultV1.sol";


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
        uint256 _marketId = marketId();
        Require.that(
            dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(_marketId, _from) &&
                dolomiteRegistry().liquidatorAssetRegistry().getLiquidatorsForAsset(_marketId).length != 0,
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
        uint256 newInputAmountWei = _unstakeBeforeUnwrapping(_accountNumber, _amount, /* _isLiquidation = */ true);
        emit PrepareForLiquidation(_accountNumber, _amount);
        return newInputAmountWei;
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
        IBaseMetaVault metaVault = IBaseMetaVault(registry().getMetaVaultByVault(address(this)));
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault))
            + metaVault.getStakedBalanceByAssetAndType(UNDERLYING_TOKEN(), defaultType);
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IMetaVaultRewardTokenFactory(VAULT_FACTORY()).berachainRewardsRegistry();
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

    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) internal override {
        uint256 factoryMarketId = marketId();
        if (_marketIdsPath[0] == factoryMarketId) {
            _inputAmountWei = _unstakeBeforeUnwrapping(
                _fromAccountNumber,
                _inputAmountWei,
                /* _isLiquidation = */ false
            );
        }

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

        if (_marketIdsPath[_marketIdsPath.length - 1] == factoryMarketId) {
            _stakeAfterWrapping();
        }
    }

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) internal override {
        uint256 factoryMarketId = marketId();
        if (_marketIdsPath[0] == factoryMarketId) {
            _inputAmountWei = _unstakeBeforeUnwrapping(
                _borrowAccountNumber,
                _inputAmountWei,
                /* _isLiquidation = */ false
            );
        }

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

        if (_marketIdsPath[_marketIdsPath.length - 1] == factoryMarketId) {
            _stakeAfterWrapping();
        }
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    ) internal override {
        uint256 factoryMarketId = marketId();
        if (_params.marketIdsPath[0] == factoryMarketId) {
            _params.inputAmountWei = _unstakeBeforeUnwrapping(
                _params.tradeAccountNumber,
                _params.inputAmountWei,
                /* _isLiquidation = */ false
            );
        }

        super._swapExactInputForOutput(_params);

        if (_params.marketIdsPath[_params.marketIdsPath.length - 1] == factoryMarketId) {
            _stakeAfterWrapping();
        }
    }

    function _unstakeBeforeUnwrapping(
        uint256 _accountNumber,
        uint256 _amountWei,
        bool _isLiquidation
    ) internal returns (uint256 _newInputAmountWei) {
        IBaseMetaVault metaVault = IBaseMetaVault(registry().getMetaVaultByVault(address(this)));
        IDolomiteStructs.Wei memory accountWei = DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _accountNumber
            }),
            marketId()
        );
        assert(accountWei.sign);

        uint256 withdrawAmount = _amountWei == type(uint256).max ? accountWei.value : _amountWei;
        Require.that(
            withdrawAmount <= accountWei.value,
            _FILE,
            "Insufficient balance"
        );

        uint256 unstakedBalance = IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault));
        if (withdrawAmount > unstakedBalance) {
            _unstake(
                UNDERLYING_TOKEN(),
                metaVault.getDefaultRewardVaultTypeByAsset(UNDERLYING_TOKEN()),
                withdrawAmount - unstakedBalance
            );
        }

        if (!_isLiquidation) {
            // @dev Only charge fees if we're not liquidating. Otherwise, this triggers a collateralization check,
            //      which reverts if the user is underwater.
            // @dev It's also possible that charging the fee this way pushes the user under water (when they previously
            //      were barely above water). If so, we expect this will revert
            uint256 feeAmount = metaVault.chargeDTokenFee(UNDERLYING_TOKEN(), marketId(), withdrawAmount);
            IIsolationModeVaultFactory(VAULT_FACTORY()).withdrawFromDolomiteMargin(_accountNumber, feeAmount);

            withdrawAmount -= feeAmount;
        }

        return withdrawAmount;
    }

    function _stakeAfterWrapping() internal {
        IBaseMetaVault metaVault = IBaseMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );

        uint256 balance = IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault));
        _stake(UNDERLYING_TOKEN(), defaultType, balance);
    }

    function _stake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 _amount) internal {
        IBaseMetaVault metaVault = IBaseMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.stakeDolomiteToken(_asset, _type, _amount);
    }

    function _unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) internal {
        IBaseMetaVault metaVault = IBaseMetaVault(registry().getMetaVaultByVault(address(this)));
        metaVault.unstakeDolomiteToken(_asset, _type, _amount);
    }

    function _getReward() internal {
        IBaseMetaVault metaVault = IBaseMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.getReward(UNDERLYING_TOKEN());
    }

    function _exit(address _asset) internal {
        IBaseMetaVault metaVault = IBaseMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.exit(_asset, true);
    }

    function _validateDepositIntoVaultAfterTransfer(
        uint256 /* _accountNumber */,
        uint256 /* _marketId */
    ) internal pure override {
        revert("Can only zap into POL vault");
    }

    function _validateWithdrawalFromVaultAfterTransfer(
        uint256 /* _accountNumber */,
        uint256 /* _marketId */
    ) internal pure override {
        revert("Can only zap out of POL vault");
    }

    function _depositIntoVaultForDolomiteMargin(
        uint256 /* _toAccountNumber */,
        uint256 /* _amountWei */
    ) internal pure override {
        revert("Not implemented");
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 /* _fromAccountNumber */,
        uint256 /* _amountWei */
    ) internal pure override {
        revert("Not implemented");
    }
}
