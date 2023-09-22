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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IUmamiAssetVault } from "../interfaces/umami/IUmamiAssetVault.sol";
import { IUmamiAssetVaultIsolationModeTokenVaultV1 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeUnwrapperTraderV2 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeVaultFactory } from "../interfaces/umami/IUmamiAssetVaultIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title   UmamiAssetVaultIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the Umami Delta Neutral Vault
 *          Token and credits a user's Dolomite balance. Assets held in the vault are considered to be in isolation mode
 *          they cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract UmamiAssetVaultIsolationModeTokenVaultV1 is
    IUmamiAssetVaultIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "UmamiVaultIsolationModeVaultV1"; // shortened to fit into 32 bytes
    bytes32 private constant _VIRTUAL_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyVaultOwnerOrUnwrapper(address _from) {
        _requireOnlyVaultOwnerOrUnwrapper(_from);
        _;
    }

    modifier onlyLiquidator(address _from) {
        if (registry().dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).marketId(),_from)) { /* FOR COVERAGE TESTING */ }
        Require.that(registry().dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(
                IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).marketId(),
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

    function initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    )
    external
    nonReentrant
    onlyVaultOwner(msg.sender)
    requireNotFrozen {
        _initiateUnwrapping(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount
        );
    }

    function initiateUnwrappingForLiquidation(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    )
    external
    payable
    nonReentrant
    onlyLiquidator(msg.sender) {
        _initiateUnwrapping(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount
        );
    }

    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] calldata _tradersPath,
        IDolomiteStructs.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external
    override
    onlyVaultOwnerOrUnwrapper(msg.sender)
    {
        if (isVaultFrozen()) {
            _requireOnlyUnwrapper(msg.sender);
        }
        _swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function setShouldSkipTransfer(
        bool _shouldSkipTransfer
    )
    external
    onlyVaultFactory(msg.sender) {
        _setShouldSkipTransfer(_shouldSkipTransfer);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(virtualBalance() + _amount);
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        _setVirtualBalance(virtualBalance() - _amount);

        if (!isShouldSkipTransfer()) {
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
            _requireVirtualBalanceMatchesRealBalance();
        } else {
            if (isVaultFrozen()) { /* FOR COVERAGE TESTING */ }
            Require.that(isVaultFrozen(),
                _FILE,
                "Vault should be frozen"
            );
            _setShouldSkipTransfer(false);
        }
    }

    function registry() public view returns (IUmamiAssetVaultRegistry) {
        return IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).umamiAssetVaultRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function virtualBalance() public view returns (uint256) {
        return _getUint256(_VIRTUAL_BALANCE_SLOT);
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        address underlyingToken = IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
        return IUmamiAssetVault(underlyingToken).withdrawalPaused();
    }

    function isShouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 /* _minOutputAmount */
    ) internal {
        _setIsVaultFrozen(true);

        // @follow-up Should we add some checks for the _outputToken to make sure user doens't DOS
        address underlyingToken = IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
        IERC20(underlyingToken).safeApprove(address(registry().withdrawalQueuer()), _inputAmount);
        bytes32 key = registry().withdrawalQueuer().queueRedeem(underlyingToken, _inputAmount);

        IUmamiAssetVaultIsolationModeUnwrapperTraderV2(registry().umamiUnwrapperTrader()).vaultSetWithdrawalInfo(
            key, _tradeAccountNumber, _inputAmount, _outputToken
        );
    }

    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    override {
        IsolationModeTokenVaultV1._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _setVirtualBalance(uint256 _bal) internal {
        _setUint256(_VIRTUAL_BALANCE_SLOT, _bal);
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) internal {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function _requireOnlyVaultOwnerOrUnwrapper(address _from) internal view {
        if (_from == address(_proxySelf().owner()) || _from == address(registry().umamiUnwrapperTrader())) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(_proxySelf().owner()) || _from == address(registry().umamiUnwrapperTrader()),
            _FILE,
            "Only owner or unwrapper can call"
        );
    }

    function _requireOnlyUnwrapper(address _from) internal view {
        if (_from == address(registry().umamiUnwrapperTrader())) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(registry().umamiUnwrapperTrader()),
            _FILE,
            "Only unwrapper if frozen"
        );
    }

    function _requireVirtualBalanceMatchesRealBalance() internal view {
        if (virtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this))) { /* FOR COVERAGE TESTING */ }
        Require.that(virtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)),
            _FILE,
            "Virtual vs real balance mismatch"
        );
    }
}
