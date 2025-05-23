// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

// solhint-disable max-line-length
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderBase.sol";
import { IsolationModeTokenVaultV1WithAsyncFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithAsyncFreezable.sol";
import { IsolationModeTokenVaultV1WithAsyncFreezableAndPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithAsyncFreezableAndPausable.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGenericTraderProxyV2 } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/IGenericTraderProxyV2.sol";
import { GmxV2Library } from "@dolomite-exchange/modules-gmx-v2/contracts/GmxV2Library.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GlvLibrary } from "./GlvLibrary.sol";
import { IGlvIsolationModeTokenVaultV1 } from "./interfaces/IGlvIsolationModeTokenVaultV1.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
// solhint-enable max-line-length


/**
 * @title   GlvIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds GLV tokens that and
 *          can be used to credit a user's Dolomite balance.
 */
contract GlvIsolationModeTokenVaultV1 is
    IGlvIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithAsyncFreezableAndPausable
{
    using DecimalLib for uint256;
    using DecimalLib for IDolomiteStructs.Decimal;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GlvIsolationModeVaultV1";

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(address _weth, uint256 _chainId) IsolationModeTokenVaultV1WithAsyncFreezable(_weth, _chainId) {
        // solhint-disable-line no-empty-blocks
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    receive() external payable {} // solhint-disable-line no-empty-blocks

    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        GlvLibrary.vaultCancelDeposit(/* _vault = */ this, _key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        GlvLibrary.vaultCancelWithdrawal(/* _vault = */ this, _key);
    }

    function isExternalRedemptionPaused()
        public
        override
        view
        returns (bool)
    {
        return GlvLibrary.isExternalRedemptionPaused(
            registry(),
            IGlvIsolationModeVaultFactory(VAULT_FACTORY())
        );
    }

    function registry() public view returns (IGlvRegistry) {
        return IGlvIsolationModeVaultFactory(VAULT_FACTORY()).glvRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
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
        GmxV2Library.validateExecutionFee(/* _vault = */ this, _toAccountNumber);
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(_toAccountNumber, msg.value);
    }

    function _openMarginPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _borrowMarketId,
        uint256 _amountWei
    )
    internal
    override {
        GmxV2Library.validateExecutionFee(/* _vault = */ this, _toAccountNumber);
        super._openMarginPosition(_fromAccountNumber, _toAccountNumber, _borrowMarketId, _amountWei);
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

    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    )
        internal
        override
    {
        _tradersPath = GmxV2Library.vaultValidateExecutionFeeIfWrapToUnderlying(
            /* _vault = */ this,
            _borrowAccountNumber,
            _tradersPath
        );
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

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderBase.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    )
        internal
        override
    {
        _tradersPath = GmxV2Library.vaultValidateExecutionFeeIfWrapToUnderlying(
            /* _vault = */ IGmxV2IsolationModeTokenVaultV1(address(this)),
            _borrowAccountNumber,
            _tradersPath
        );
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

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
        internal
        virtual
        override
    {
        _params.tradersPath = GmxV2Library.vaultValidateExecutionFeeIfWrapToUnderlying(
            /* _vault = */ IGmxV2IsolationModeTokenVaultV1(address(this)),
            _params.tradeAccountNumber,
            _params.tradersPath
        );
        super._swapExactInputForOutput(_params);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal override {
        IGlvIsolationModeVaultFactory factory = IGlvIsolationModeVaultFactory(VAULT_FACTORY());
        GmxV2Library.validateInitiateUnwrapping(factory, factory.glvRegistry(), _outputToken);

        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = registry().getUnwrapperByToken(factory);
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(unwrapper), _inputAmount);
        unwrapper.vaultInitiateUnwrapping{ value: ethExecutionFee }(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function _checkMsgValue() internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Don't do any validation here. We check the msg.value conditionally in the `swapExactInputForOutput`
        // implementation
    }

    function _validateMinAmountIsNotTooLarge(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal override view {
        if (!_isLiquidation) {
            // GUARD statement
            return;
        }

        IDolomiteStructs.AccountInfo memory liquidAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _tradeAccountNumber
        });

        GmxV2Library.validateMinAmountIsNotTooLargeForLiquidation(
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()),
            liquidAccount,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _extraData,
            CHAIN_ID
        );
    }
}
