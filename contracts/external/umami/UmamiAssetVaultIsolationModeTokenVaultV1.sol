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

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IUmamiAssetVault } from "../interfaces/umami/IUmamiAssetVault.sol";
import { IUmamiAssetVaultIsolationModeTokenVaultV1 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeUnwrapperTraderV2 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeVaultFactory } from "../interfaces/umami/IUmamiAssetVaultIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length


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
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "UmamiVaultIsolationModeVaultV1"; // shortened to fit into 32 bytes
    bytes32 private constant _VIRTUAL_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _POSITION_TO_EXECUTION_FEE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.positionToExecutionFee")) - 1); // solhint-disable-line max-line-length

    uint256 public constant EXECUTION_FEE = 0.0005 ether;

    // ==================================================================
    // ====================== Immutable Variables =======================
    // ==================================================================

    IWETH public immutable WETH; // solhint-disable-line var-name-mixedcase

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyVaultOwnerOrUnwrapper(address _from) {
        _requireOnlyVaultOwnerOrUnwrapper(_from);
        _;
    }

    modifier onlyLiquidator(address _from) {
        Require.that(
            registry().dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(
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
    // ======================== Constructor ========================
    // ==================================================================

    constructor(address _weth) {
        WETH = IWETH(_weth);
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
    payable
    nonReentrant
    onlyVaultOwner(msg.sender)
    requireNotFrozen {
        _initiateUnwrapping(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            /* _isLiquidation = */ false
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
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _tradeAccountNumber
        });
        Require.that(
            _inputAmount == DOLOMITE_MARGIN().getAccountWei(account, marketId()).value,
            _FILE,
            "Invalid inputAmount"
        );
        _initiateUnwrapping(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            /* _isLiquidation = */ true
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
    payable
    override
    onlyVaultOwnerOrUnwrapper(msg.sender)
    {
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

        if (!shouldSkipTransfer()) {
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
            _requireVirtualBalanceMatchesRealBalance();
        } else {
            Require.that(
                isVaultFrozen(),
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

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function getExecutionFeeForAccountNumber(uint256 _accountNumber) public view returns (uint256) {
        return _getUint256(keccak256(abi.encode(_POSITION_TO_EXECUTION_FEE_SLOT, _accountNumber)));
    }

    function isWaitingForCallback(uint256 _accountNumber) public view returns (bool) {
        return registry().isAccountWaitingForCallback(/* _vault = */ address(this), _accountNumber);
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        Require.that(
            msg.value == EXECUTION_FEE,
            _FILE,
            "Invalid execution fee"
        );
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(
            _toAccountNumber,
            getExecutionFeeForAccountNumber(_toAccountNumber) + msg.value
        );
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        Require.that(
            getExecutionFeeForAccountNumber(_borrowAccountNumber) != 0,
            _FILE,
            "Missing execution fee"
        );
        super._transferIntoPositionWithUnderlyingToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
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
        // uint256 len = _tradersPath.length;
        // if (_tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
        //         msg.value > 0,
        //         _FILE,
        //         "Invalid execution fee"
        //     );
        //     _tradersPath[len - 1].tradeData = abi.encode(_tradeAccountNumber, msg.value);
        //     WETH.deposit{value: msg.value}();
        //     WETH.safeApprove(address(registry().gmxV2WrapperTrader()), msg.value);
        // } else {
            // @follow-up Since umami wrapping is one step, do we need this. I think so but we will have to adjust the wrapper trader
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        // }

        if (_tradersPath[0].traderType == IGenericTraderBase.TraderType.IsolationModeUnwrapper) {
            // Only the unwrapper can initiate unwraps (via the callback)
            _requireOnlyUnwrapper(msg.sender);
        }

        if (isVaultFrozen()) {
            // This guarantees only a handler is executing the swap
            _requireOnlyUnwrapper(msg.sender);
        }

        IsolationModeTokenVaultV1WithPausable._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

     function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        super._transferFromPositionWithUnderlyingToken(_borrowAccountNumber, _toAccountNumber, _amountWei);
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal
    override {
        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    internal
    override {
        super._closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    internal
    override {
        super._closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        // @follow-up Do we want to do something with this?
        uint256 /* _minOutputAmount */,
        bool _isLiquidation
    ) internal {
        Require.that(
            registry().umamiUnwrapperTrader().isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );
        _setIsVaultFrozen(/* _isVaultFrozen = */ true);

        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        address underlyingToken = IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
        IERC20(underlyingToken).safeApprove(address(registry().withdrawalQueuer()), _inputAmount);

        bytes32 key = registry().withdrawalQueuer().queueRedeem(underlyingToken, _inputAmount);
        IUmamiAssetVaultIsolationModeUnwrapperTraderV2(registry().umamiUnwrapperTrader()).vaultSetWithdrawalInfo(
            key, _tradeAccountNumber, _inputAmount, _outputToken
        );
    }

    function _setVirtualBalance(uint256 _bal) internal {
        _setUint256(_VIRTUAL_BALANCE_SLOT, _bal);
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) internal {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function _setExecutionFeeForAccountNumber(
        uint256 _accountNumber,
        uint256 _executionFee
    ) internal {
        _setUint256(keccak256(abi.encode(_POSITION_TO_EXECUTION_FEE_SLOT, _accountNumber)), _executionFee);
        emit ExecutionFeeSet(_accountNumber, _executionFee);
    }

    function _requireOnlyVaultOwnerOrUnwrapper(address _from) internal view {
        Require.that(
            _from == address(_proxySelf().owner()) || _from == address(registry().umamiUnwrapperTrader()),
            _FILE,
            "Only owner or unwrapper can call"
        );
    }

    function _requireVirtualBalanceMatchesRealBalance() internal view {
        Require.that(
            virtualBalance() == IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)),
            _FILE,
            "Virtual vs real balance mismatch"
        );
    }

    function _requireOnlyUnwrapper(address _from) internal view {
        Require.that(
            _from == address(registry().umamiUnwrapperTrader()),
            _FILE,
            "Only unwrapper can call",
            _from
        );
    }

    function _checkMsgValue() internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Don't do any validation here. We check the msg.value conditionally in the `swapExactInputForOutput`
        // implementation
    }

    function _refundExecutionFeeIfNecessary(uint256 _borrowAccountNumber) private {
        IDolomiteStructs.AccountInfo memory borrowAccountInfo = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _borrowAccountNumber
        });
        if (DOLOMITE_MARGIN().getAccountNumberOfMarketsWithBalances(borrowAccountInfo) == 0) {
            // There's no assets left in the position. Issue a refund for the execution fee
            // The refund is sent as WETH to eliminate reentrancy concerns
            uint256 executionFee = getExecutionFeeForAccountNumber(_borrowAccountNumber);
            _setExecutionFeeForAccountNumber(_borrowAccountNumber, /* _executionFee = */ 0);
            WETH.deposit{value: executionFee}();
            WETH.safeTransfer(msg.sender, executionFee);
        }
    }
}
