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
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IGmxRegistryV2 } from "./GmxRegistryV2.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is
    IGmxV2IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using Address for address payable;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";
    bytes32 private constant _VIRTUAL_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);
    bytes32 private constant _IS_DEPOSIT_SOURCE_WRAPPER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceWrapper")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _POSITION_TO_EXECUTION_FEE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.positionToExecutionFee")) - 1); // solhint-disable-line max-line-length

    // ==================================================================
    // ====================== Immutable Variables =======================
    // ==================================================================

    IWETH public immutable WETH; // solhint-disable-line var-name-mixedcase

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyLiquidator(address _from) {
        Require.that(
            registry().dolomiteRegistry().liquidatorAssetRegistry().isAssetWhitelistedForLiquidation(
                IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).marketId(),
                _from
            ),
            _FILE,
            "Only liquidator can call",
            _from
        );
        _;
    }

    // ==================================================================
    // ========================== Constructors ==========================
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
        requireNotFrozen
    {
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
        onlyLiquidator(msg.sender)
    {
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

    // @audit Need to check this can't be used to unfreeze the vault with a dummy deposit. I don't think it can
    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        _validateVaultOwnerForStruct(registry().gmxV2WrapperTrader().getDepositInfo(_key).vault);
        registry().gmxV2WrapperTrader().cancelDeposit(_key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        _validateVaultOwnerForStruct(registry().gmxV2UnwrapperTrader().getWithdrawalInfo(_key).vault);
        registry().gmxExchangeRouter().cancelWithdrawal(_key);
    }

    function setIsDepositSourceWrapper(
        bool _isDepositSourceWrapper
    )
    external
    onlyVaultFactory(msg.sender) {
        _setIsDepositSourceWrapper(_isDepositSourceWrapper);
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

        if (!shouldSkipTransfer()) {
            if (!isDepositSourceWrapper()) {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
            } else {
                IERC20(UNDERLYING_TOKEN()).safeTransferFrom(
                    address(registry().gmxV2WrapperTrader()),
                    address(this),
                    _amount
                );
                _setIsDepositSourceWrapper(false);
            }
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

    function isExternalRedemptionPaused()
        public
        override
        view
        returns (bool)
    {
        return GmxV2Library.isExternalRedemptionPaused(
            registry(),
            DOLOMITE_MARGIN(),
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY())
        );
    }

    function virtualBalance() public view returns (uint256) {
        return _getUint256(_VIRTUAL_BALANCE_SLOT);
    }

    function isDepositSourceWrapper() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_WRAPPER_SLOT) == 1;
    }

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function registry() public view returns (IGmxRegistryV2) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistryV2();
    }

    function dolomiteRegistry()
    public
    override
    view
    returns (IDolomiteRegistry) {
        return registry().dolomiteRegistry();
    }

    function getExecutionFeeForAccountNumber(uint256 _accountNumber) public view returns (uint256) {
        return _getUint256(keccak256(abi.encode(_POSITION_TO_EXECUTION_FEE_SLOT, _accountNumber)));
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
        GmxV2Library.validateExecutionFee(this, _toAccountNumber);
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(_toAccountNumber, msg.value);
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
    virtual
    override {
        uint256 len = _tradersPath.length;
        if (_tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            GmxV2Library.depositAndApproveWethForWrapping(this);
            _tradersPath[len - 1].tradeData = abi.encode(_tradeAccountNumber, msg.value);
//            WETH.deposit{value: msg.value}();
//            WETH.safeApprove(address(registry().gmxV2WrapperTrader()), msg.value);
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }

        if (_tradersPath[0].traderType == IGenericTraderBase.TraderType.IsolationModeUnwrapper) {
            // Only the unwrapper can initiate unwraps (via the callback)
            _requireOnlyUnwrapper(msg.sender);
        }

        if (isVaultFrozen()) {
            // This guarantees only a handler is executing the swap
            _requireOnlyUnwrapper(msg.sender);
        }

        // Ignore the freezable implementation and call the pausable one directly
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
        super._transferFromPositionWithUnderlyingToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _amountWei
        );
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
        super._closeBorrowPositionWithUnderlyingVaultToken(
            _borrowAccountNumber,
            _toAccountNumber
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    internal
    override {
        super._closeBorrowPositionWithOtherTokens(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        );
        _refundExecutionFeeIfNecessary(_borrowAccountNumber);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation
    ) internal {
        Require.that(
            registry().gmxV2UnwrapperTrader().isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );
        IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).setIsVaultAccountFrozen(
            /* _vault */ address(this),
            _tradeAccountNumber,
            /* _isFrozen = */ true
        );

        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        GmxV2Library.executeInitiateUnwrapping(
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()),
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            ethExecutionFee
        );
    }

    function _setVirtualBalance(uint256 _bal) internal {
        _setUint256(_VIRTUAL_BALANCE_SLOT, _bal);
    }

    function _setIsDepositSourceWrapper(bool _isDepositSourceWrapper) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_WRAPPER_SLOT, _isDepositSourceWrapper ? 1 : 0);
        emit IsDepositSourceWrapperSet(_isDepositSourceWrapper);
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) internal {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
        emit ShouldSkipTransferSet(_shouldSkipTransfer);
    }

    function _setExecutionFeeForAccountNumber(
        uint256 _accountNumber,
        uint256 _executionFee
    ) internal {
        _setUint256(keccak256(abi.encode(_POSITION_TO_EXECUTION_FEE_SLOT, _accountNumber)), _executionFee);
        emit ExecutionFeeSet(_accountNumber, _executionFee);
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
            _from == address(registry().gmxV2UnwrapperTrader()),
            _FILE,
            "Only unwrapper can call",
            _from
        );
    }

    function _validateVaultOwnerForStruct(address _vault) internal view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
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
            uint256 executionFee = getExecutionFeeForAccountNumber(_borrowAccountNumber);
            _setExecutionFeeForAccountNumber(_borrowAccountNumber, /* _executionFee = */ 0);
            // @audit: check for any reentrancy issues! No user-level functions on the vault should be reentered
            payable(_proxySelf().owner()).sendValue(executionFee);
        }
    }
}
