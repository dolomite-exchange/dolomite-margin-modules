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
import { ProxyContractHelpers } from "../../helpers/ProxyContractHelpers.sol";
import { IBorrowPositionProxyV2 } from "../../interfaces/IBorrowPositionProxyV2.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGenericTraderProxyV2 } from "../../proxies/interfaces/IGenericTraderProxyV2.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IsolationModeTokenVaultV1ActionsImpl } from "./impl/IsolationModeTokenVaultV1ActionsImpl.sol";


/**
 * @title   IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Abstract implementation (for an upgradeable proxy) for wrapping tokens via a per-user vault that can be used
 *          with DolomiteMargin
 */
abstract contract IsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1, ProxyContractHelpers {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeTokenVaultV1";
    bytes32 private constant _IS_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isInitialized")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _REENTRANCY_GUARD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.reentrancyGuard")) - 1);
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // =================================================
    // ================ Field Variables ================
    // =================================================

    /// @dev This is unused, but required to keep the storage slots the same
    uint256 private _reentrancyGuard;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyVaultFactory(address _from) {
        _requireOnlyVaultFactory(_from);
        _;
    }

    modifier onlyVaultOwner(address _from) {
        _requireOnlyVaultOwner(_from);
        _;
    }

    modifier onlyVaultOwnerOrConverter(address _from) {
        _requireOnlyVaultOwnerOrConverter(_from);
        _;
    }

    modifier onlyVaultOwnerOrVaultFactory(address _from) {
        _requireOnlyVaultOwnerOrVaultFactory(_from);
        _;
    }

    modifier requireNotLiquidatable(uint256 _accountNumber) {
        _requireNotLiquidatable(_accountNumber);
        _;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly. Calling a `nonReentrant` function from
     *      another `nonReentrant` function is not supported. It is possible to prevent this from happening by making
     *      the `nonReentrant` function external, and making it call a `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function initialize() external {
        _initialize();
    }

    function multicall(
        bytes[] memory _calls
    )
    external
    onlyVaultOwnerOrConverter(msg.sender) {
        IsolationModeTokenVaultV1ActionsImpl.multicall(_calls, dolomiteRegistry());
    }

    function depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        _depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyVaultOwner(msg.sender) {
        _withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    payable
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _checkMsgValue();
        _openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function openMarginPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _borrowMarketId,
        uint256 _amountWei
    )
    external
    payable
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _checkMsgValue();
        _openMarginPosition(_fromAccountNumber, _toAccountNumber, _borrowMarketId, _amountWei);
    }

    function closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
    }

    function closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
    }

    function transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
    }

    function transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _transferIntoPositionWithOtherToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _transferFromPositionWithUnderlyingToken(_borrowAccountNumber, _toAccountNumber, _amountWei);
    }

    function transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _repayAllForBorrowPosition(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    function addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV2.UserConfig calldata _userConfig
    )
    external
    payable
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _checkMsgValue();
        _addCollateralAndSwapExactInputForOutput(
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

    function swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV2.UserConfig calldata _userConfig
    )
    external
    payable
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _checkMsgValue();
        _swapExactInputForOutputAndRemoveCollateral(
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


    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV2.UserConfig calldata _userConfig
    )
    external
    payable
    nonReentrant
    onlyVaultOwnerOrConverter(msg.sender) {
        _checkMsgValue();
        SwapExactInputForOutputParams memory params = SwapExactInputForOutputParams({
            tradeAccountNumber: _tradeAccountNumber,
            marketIdsPath: _marketIdsPath,
            inputAmountWei: _inputAmountWei,
            minOutputAmountWei: _minOutputAmountWei,
            tradersPath: _tradersPath,
            makerAccounts: _makerAccounts,
            userConfig: _userConfig
        });
        _swapExactInputForOutput(params);
    }

    // ======== Public functions ========

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    virtual
    onlyVaultFactory(msg.sender) {
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    virtual
    onlyVaultFactory(msg.sender) {
        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

     function validateDepositIntoVaultAfterTransfer(
        uint256 _accountNumber,
        uint256 _marketId
    ) external view {
         _validateDepositIntoVaultAfterTransfer(_accountNumber, _marketId);
    }

    function validateWithdrawalFromVaultAfterTransfer(
        uint256 _accountNumber,
        uint256 _marketId
    ) external view {
        _validateWithdrawalFromVaultAfterTransfer(_accountNumber, _marketId);
    }

    function UNDERLYING_TOKEN() public view returns (address) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
    }

    function DOLOMITE_MARGIN() public view returns (IDolomiteMargin) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).DOLOMITE_MARGIN();
    }

    function BORROW_POSITION_PROXY() public view returns (IBorrowPositionProxyV2) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).BORROW_POSITION_PROXY();
    }

    function VAULT_FACTORY() public view returns (address) {
        return _getAddress(_VAULT_FACTORY_SLOT);
    }

    function OWNER() public override view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }

    function marketId() public view returns (uint256) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).marketId();
    }

    function underlyingBalanceOf() public override virtual view returns (uint256) {
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(this));
    }

    function dolomiteRegistry() public override virtual view returns (IDolomiteRegistry);

    // ============ Internal Functions ============

    function _initialize() internal virtual {
        Require.that(
            _getUint256(_IS_INITIALIZED_SLOT) == 0,
            _FILE,
            "Already initialized"
        );

        _setUint256(_REENTRANCY_GUARD_SLOT, _NOT_ENTERED);
    }

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal virtual {
        IsolationModeTokenVaultV1ActionsImpl.depositIntoVaultForDolomiteMargin(
            /* _vault = */ this,
            _toAccountNumber,
            _amountWei
        );
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal virtual {
        IsolationModeTokenVaultV1ActionsImpl.withdrawFromVaultForDolomiteMargin(
            /* _vault = */ this,
            _fromAccountNumber,
            _amountWei
        );
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.openBorrowPosition(
            /* _vault = */ this,
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        );
    }

    function _openMarginPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _borrowMarketId,
        uint256 _amountWei
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.openMarginPosition(
            /* _vault = */ this,
            _fromAccountNumber,
            _toAccountNumber,
            _borrowMarketId,
            _amountWei
        );
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.closeBorrowPositionWithUnderlyingVaultToken(
            /* _vault = */ this,
            _borrowAccountNumber,
            _toAccountNumber
        );
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.closeBorrowPositionWithOtherTokens(
            /* _vault = */ this,
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        );
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.transferIntoPositionWithUnderlyingToken(
            /* _vault = */ this,
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        );
    }

    function _transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.transferIntoPositionWithOtherToken(
            /* _vault = */ this,
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag,
            /* _checkAllowableCollateralMarketFlag =  */ true,
            /* _bypassAccountNumberCheck = */ false
        );
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.transferFromPositionWithUnderlyingToken(
            /* _vault = */ this,
            _borrowAccountNumber,
            _toAccountNumber,
            _amountWei
        );
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        virtual
        internal
    {
        IsolationModeTokenVaultV1ActionsImpl.transferFromPositionWithOtherToken(
            /* _vault = */ this,
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag,
            /* _bypassAccountNumberCheck = */ false
        );
    }

    function _repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.repayAllForBorrowPosition(
            /* _vault = */ this,
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) internal virtual {
        IsolationModeTokenVaultV1ActionsImpl.addCollateralAndSwapExactInputForOutput(
            /* _vault = */ this,
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

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.swapExactInputForOutputAndRemoveCollateral(
            /* _vault = */ this,
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

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
        internal
        virtual
    {
        IsolationModeTokenVaultV1ActionsImpl.swapExactInputForOutput(
            /* _vault = */ this,
            _params.tradeAccountNumber,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei,
            _params.tradersPath,
            _params.makerAccounts,
            _params.userConfig,
            /* _checkOutputMarketIdFlag = */ true,
            /* _bypassAccountNumberCheck = */ false
        );
    }

    function _requireOnlyVaultFactory(address _from) internal view {
        Require.that(
            _from == address(VAULT_FACTORY()),
            _FILE,
            "Only factory can call",
            _from
        );
    }

    function _validateDepositIntoVaultAfterTransfer(
        uint256 _accountNumber,
        uint256 _marketId
    ) internal virtual view {
        IsolationModeTokenVaultV1ActionsImpl.validateDepositIntoVaultAfterTransfer(
            /* _vault = */ this,
            _accountNumber,
            _marketId
        );
    }

    function _validateWithdrawalFromVaultAfterTransfer(
        uint256 _accountNumber,
        uint256 _marketId
    ) internal virtual view {
        IsolationModeTokenVaultV1ActionsImpl.validateWithdrawalFromVaultAfterTransfer(
            /* _vault = */ this,
            _accountNumber,
            _marketId
        );
    }

    function _requireOnlyVaultOwner(address _from) internal virtual view {
        Require.that(
            _from == OWNER(),
            _FILE,
            "Only owner can call",
            _from
        );
    }

    function _requireOnlyVaultOwnerOrConverter(address _from) internal virtual view {
        Require.that(
            _from == address(OWNER())
                || IIsolationModeVaultFactory(VAULT_FACTORY()).isTokenConverterTrusted(_from),
            _FILE,
            "Only owner or converter can call",
            _from
        );
    }

    function _requireOnlyVaultOwnerOrVaultFactory(address _from) internal virtual view {
        Require.that(
            _from == address(OWNER()) || _from == VAULT_FACTORY(),
            _FILE,
            "Only owner or factory can call",
            _from
        );
    }

    function _requireOnlyConverter(address _from) internal virtual view {
        Require.that(
            IIsolationModeVaultFactory(VAULT_FACTORY()).isTokenConverterTrusted(_from),
            _FILE,
            "Only converter can call",
            _from
        );
    }

    function _requireNotLiquidatable(uint256 _accountNumber) internal view {
        IsolationModeTokenVaultV1ActionsImpl.validateIsNotLiquidatable(
            /* _vault = */ this,
            _accountNumber
        );
    }

    /**
     *  Called within `swapExactInputForOutput` to check that the caller send the right amount of ETH with the
     *  transaction.
     */
    function _checkMsgValue() internal virtual view {
        Require.that(
            msg.value == 0,
            _FILE,
            "Cannot send ETH"
        );
    }

    // ===========================================
    // ============ Private Functions ============
    // ===========================================

    function _nonReentrantBefore() private {
        // @notice:  This MUST stay as `value != _ENTERED` otherwise it will DOS old vaults that don't have the
        //          `initialize` fix
        Require.that(
            _getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED,
            _FILE,
            "Reentrant call"
        );

        // Any calls to nonReentrant after this point will fail
        _setUint256(_REENTRANCY_GUARD_SLOT, _ENTERED);
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _setUint256(_REENTRANCY_GUARD_SLOT, _NOT_ENTERED);
    }
}
