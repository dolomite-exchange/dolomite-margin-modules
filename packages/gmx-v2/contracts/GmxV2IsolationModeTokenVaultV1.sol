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

// solhint-disable max-line-length
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderBase.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import { IFreezableIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IGmxV2Registry } from "./GmxV2Registry.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "./interfaces/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds any GMX V2 Market token that and
 *          can be used to credit a user's Dolomite balance.
 * @dev     In certain cases, GM tokens may be refunded to the vault owner.
 *          The vault owner MUST be able to handle GM tokens
 */
contract GmxV2IsolationModeTokenVaultV1 is
    IGmxV2IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using DecimalLib for uint256;
    using DecimalLib for IDolomiteStructs.Decimal;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(address _weth, uint256 _chainId) IsolationModeTokenVaultV1WithFreezable(_weth, _chainId) {
        // solhint-disable-line no-empty-blocks
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper =
                                registry().getWrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo
            = unwrapper.getWithdrawalInfo(_key);
        _validateVaultOwnerForStruct(withdrawalInfo.vault);
        Require.that(
            !withdrawalInfo.isLiquidation,
            _FILE,
            "Withdrawal from liquidation"
        );
        unwrapper.initiateCancelWithdrawal(_key);
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

    function registry() public view returns (IGmxV2Registry) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxV2Registry();
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

    /**
     *
     *  @dev  _minOutputAmountWei MUST BE greater than 0 or call will revert
     */
    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
    internal
    virtual
    override {
        uint256 len = _params.tradersPath.length;
        if (_params.tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            GmxV2Library.depositAndApproveWethForWrapping(this);
            Require.that(
                msg.value <= IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).maxExecutionFee(),
                _FILE,
                "Invalid execution fee"
            );
            _params.tradersPath[len - 1].tradeData = abi.encode(_params.tradeAccountNumber, abi.encode(msg.value));
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }

        if (
            _params.tradersPath[0].traderType == IGenericTraderBase.TraderType.IsolationModeUnwrapper ||
            isVaultFrozen()
        ) {
            // Only a trusted converter can initiate unwraps (via the callback) OR execute swaps if the vault is frozen
            _requireOnlyConverter(msg.sender);
        }

        // Ignore the freezable implementation and call the pausable one directly
        _requireNotLiquidatableIfWrapToUnderlying(
            _params.tradeAccountNumber,
            _params.marketIdsPath[_params.marketIdsPath.length - 1]
        );

        IsolationModeTokenVaultV1WithPausable._swapExactInputForOutput(_params);
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal override {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY());
        Require.that(
            registry().getUnwrapperByToken(factory).isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );

        Require.that(
            msg.value <= IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).maxExecutionFee(),
            _FILE,
            "Invalid execution fee"
        );
        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IIsolationModeVaultFactory(VAULT_FACTORY()));
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

        IDolomiteStructs.AccountInfo memory tradeAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _tradeAccountNumber
        });

        GmxV2Library.validateMinAmountIsNotTooLargeForLiquidation(
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()),
            tradeAccount,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _extraData,
            CHAIN_ID
        );
    }
}
