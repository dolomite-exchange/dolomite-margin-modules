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
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { IBorrowPositionProxyV2 } from "../../interfaces/IBorrowPositionProxyV2.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderProxyV1 } from "../../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeUpgradeableProxy } from "../../interfaces/IIsolationModeUpgradeableProxy.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Abstract implementation (for an upgradeable proxy) for wrapping tokens via a per-user vault that can be used
 *          with DolomiteMargin
 */
abstract contract IsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeTokenVaultV1";
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // =================================================
    // ================ Field Variables ================
    // =================================================

    uint256 private _reentrancyGuard;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyVaultFactory(address _from) {
        if (_from == address(VAULT_FACTORY())) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(VAULT_FACTORY()),
            _FILE,
            "Only factory can call",
            _from
        );
        _;
    }

    modifier onlyVaultOwner(address _from) {
        _requireOnlyVaultOwner(_from);
        _;
    }

    modifier onlyVaultOwnerOrVaultFactory(address _from) {
        _requireOnlyVaultOwnerOrVaultFactory(_from);
        _;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly. Calling a `nonReentrant` function from
     *      another `nonReentrant` function is not supported. It is possible to prevent this from happening by making
     *      the `nonReentrant` function external, and making it call a `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _reentrancyGuard will be _NOT_ENTERED
        if (_reentrancyGuard != _ENTERED) { /* FOR COVERAGE TESTING */ }
        Require.that(_reentrancyGuard != _ENTERED,
            _FILE,
            "Reentrant call"
        );

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuard = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuard = _NOT_ENTERED;
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function initialize() external {
        if (_reentrancyGuard == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_reentrancyGuard == 0,
            _FILE,
            "Already initialized"
        );

        _reentrancyGuard = _NOT_ENTERED;
    }

    function depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        _depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        _withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
        _openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    external
    onlyVaultOwner(msg.sender) {
        _closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
    }

    function closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    external
    onlyVaultOwner(msg.sender) {
        _closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
    }

    function transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    external
    onlyVaultOwner(msg.sender) {
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
    onlyVaultOwner(msg.sender) {
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
    onlyVaultOwner(msg.sender) {
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
    onlyVaultOwner(msg.sender) {
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
    onlyVaultOwner(msg.sender) {
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
        IGenericTraderProxyV1.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external
    onlyVaultOwner(msg.sender) {
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
        IGenericTraderProxyV1.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external
    onlyVaultOwner(msg.sender) {
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
        IGenericTraderProxyV1.TraderParam[] calldata _tradersPath,
        IDolomiteMargin.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external
    onlyVaultOwner(msg.sender) {
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
        /*assert(_recipient != address(this));*/
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
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

    function VAULT_FACTORY() public virtual view returns (address) {
        return _proxySelf().vaultFactory();
    }

    function marketId() public view returns (uint256) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).marketId();
    }

    function underlyingBalanceOf() public override virtual view returns (uint256) {
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(this));
    }

    function dolomiteRegistry() public override virtual view returns (IDolomiteRegistry);

    // ============ Internal Functions ============

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal {
        // This implementation requires we deposit into index 0
        if (_toAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );
        IIsolationModeVaultFactory(VAULT_FACTORY()).depositIntoDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal {
        // This implementation requires we withdraw from index 0
        if (_fromAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        IIsolationModeVaultFactory(VAULT_FACTORY()).withdrawFromDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
    {
        if (_fromAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        if (_toAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_toAccountNumber != 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        BORROW_POSITION_PROXY().openBorrowPosition(
            _fromAccountNumber,
            _toAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
        internal
        virtual
    {
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        if (_toAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        uint256[] memory collateralMarketIds = new uint256[](1);
        collateralMarketIds[0] = marketId();

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
        /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this),
            _toAccountNumber,
            collateralMarketIds
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
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        uint256 underlyingMarketId = marketId();
        for (uint256 i = 0; i < _collateralMarketIds.length; i++) {
            if (_collateralMarketIds[i] != underlyingMarketId) { /* FOR COVERAGE TESTING */ }
            Require.that(_collateralMarketIds[i] != underlyingMarketId,
                _FILE,
                "Cannot withdraw market to wallet",
                underlyingMarketId
            );
        }

        BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender,
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
        if (_fromAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );

        BORROW_POSITION_PROXY().transferBetweenAccounts(
            _fromAccountNumber,
            _borrowAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
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
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        if (_marketId != marketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender,
            _fromAccountNumber,
            /* _toAccountOwner = */ address(this),
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        _checkAllowableCollateralMarket(address(this), _borrowAccountNumber, _marketId);
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        virtual
        internal
    {
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        if (_toAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        BORROW_POSITION_PROXY().transferBetweenAccounts(
            _borrowAccountNumber,
            _toAccountNumber,
            marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
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
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        if (_marketId != marketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );

        BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
            /* _fromAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        _checkAllowableDebtMarket(address(this), _borrowAccountNumber, _marketId);
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
        if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_borrowAccountNumber != 0,
            _FILE,
            "Invalid borrowAccountNumber",
            _borrowAccountNumber
        );
        if (_marketId != marketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketId != marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );
        BORROW_POSITION_PROXY().repayAllForBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ msg.sender,
            _fromAccountNumber,
            /* _borrowAccountOwner = */ address(this),
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
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) internal virtual {
        if (_marketIdsPath[0] == marketId()) {
            _transferIntoPositionWithUnderlyingToken(
                _fromAccountNumber,
                _borrowAccountNumber,
                _inputAmountWei
            );
        } else {
            IDolomiteStructs.Par memory inputMarketBalance = DOLOMITE_MARGIN().getAccountPar(
                IDolomiteStructs.AccountInfo({
                    owner: address(this),
                    number: _borrowAccountNumber
                }),
                _marketIdsPath[0]
            );
            if (inputMarketBalance.isPositive() || inputMarketBalance.value == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(inputMarketBalance.isPositive() || inputMarketBalance.value == 0,
                _FILE,
                "Input balance must be >= 0",
                _marketIdsPath[0]
            );
            _transferIntoPositionWithOtherToken(
                _fromAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath[0],
                _inputAmountWei,
                _userConfig.balanceCheckFlag
            );
        }

        _swapExactInputForOutput(
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
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
        internal
        virtual
    {
        uint256 outputMarketId = _marketIdsPath[_marketIdsPath.length - 1];
        // Validate the output balance before executing the swap
        IDolomiteStructs.Wei memory balanceBefore = DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            }),
            outputMarketId
        );
        if (balanceBefore.isPositive() || balanceBefore.value == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(balanceBefore.isPositive() || balanceBefore.value == 0,
            _FILE,
            "Output balance must be >= 0"
        );

        _swapExactInputForOutput(
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );

        IDolomiteStructs.Wei memory balanceAfter = DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            }),
            outputMarketId
        );

        // Panic if the user's balance after is not >= the balance before + the min output amount. Panic if the balance
        // after is somehow negative.
        /*assert(balanceAfter.value >= balanceBefore.value + _minOutputAmountWei && balanceAfter.isPositive());*/

        if (outputMarketId == marketId()) {
            _transferFromPositionWithUnderlyingToken(
                _borrowAccountNumber,
                _toAccountNumber,
                balanceAfter.value - balanceBefore.value
            );
        } else {
            _transferFromPositionWithOtherToken(
                _borrowAccountNumber,
                _toAccountNumber,
                outputMarketId,
                balanceAfter.value - balanceBefore.value,
                _userConfig.balanceCheckFlag
            );
        }
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
        virtual
    {
        if (_tradeAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_tradeAccountNumber != 0,
            _FILE,
            "Invalid tradeAccountNumber",
            _tradeAccountNumber
        );

        dolomiteRegistry().genericTraderProxy().swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );

        uint256 inputMarketId = _marketIdsPath[0];
        uint256 outputMarketId = _marketIdsPath[_marketIdsPath.length - 1];
        address tradeAccountOwner = address(this);
        _checkAllowableCollateralMarket(tradeAccountOwner, _tradeAccountNumber, inputMarketId);
        _checkAllowableCollateralMarket(tradeAccountOwner, _tradeAccountNumber, outputMarketId);
        _checkAllowableDebtMarket(tradeAccountOwner, _tradeAccountNumber, inputMarketId);
        _checkAllowableDebtMarket(tradeAccountOwner, _tradeAccountNumber, outputMarketId);
    }

    function _requireOnlyVaultOwner(address _from) internal virtual view {
        if (_from == _proxySelf().owner()) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == _proxySelf().owner(),
            _FILE,
            "Only owner can call",
            _from
        );
    }

    function _requireOnlyVaultOwnerOrVaultFactory(address _from) internal virtual view {
        if (_from == address(_proxySelf().owner()) || _from == VAULT_FACTORY()) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(_proxySelf().owner()) || _from == VAULT_FACTORY(),
            _FILE,
            "Only owner or factory can call",
            _from
        );
    }

    function _checkAllowableCollateralMarket(
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) internal view {
        // If the balance is positive, check that the collateral is for an allowable market. We use the Par balance
        // because, it uses less gas than getting the Wei balance, and we're only checking whether the balance is
        // positive.
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isPositive()) {
            // Check the allowable collateral markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(VAULT_FACTORY());
            uint256[] memory allowableCollateralMarketIds = vaultFactory.allowableCollateralMarketIds();
            uint256 allowableCollateralsLength = allowableCollateralMarketIds.length;
            if (allowableCollateralsLength != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableCollateralsLength; i++) {
                    if (allowableCollateralMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                if (isAllowable) { /* FOR COVERAGE TESTING */ }
                Require.that(isAllowable,
                    _FILE,
                    "Market not allowed as collateral",
                    _marketId
                );
            }
        }
    }

    function _proxySelf() internal view returns (IIsolationModeUpgradeableProxy) {
        return IIsolationModeUpgradeableProxy(address(this));
    }

    function _checkAllowableDebtMarket(
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) internal view {
        // If the balance is negative, check that the debt is for an allowable market. We use the Par balance because,
        // it uses less gas than getting the Wei balance, and we're only checking whether the balance is negative.
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isNegative()) {
            // Check the allowable debt markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(VAULT_FACTORY());
            uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
            if (allowableDebtMarketIds.length != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableDebtMarketIds.length; i++) {
                    if (allowableDebtMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                if (isAllowable) { /* FOR COVERAGE TESTING */ }
                Require.that(isAllowable,
                    _FILE,
                    "Market not allowed as debt",
                    _marketId
                );
            }
        }
    }
}
