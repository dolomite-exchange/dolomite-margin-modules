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
import { AsyncIsolationModeTraderBase } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/AsyncIsolationModeTraderBase.sol";
import { UpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/UpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { AsyncIsolationModeUnwrapperTraderImpl } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/impl/AsyncIsolationModeUnwrapperTraderImpl.sol"; // solhint-disable-line max-line-length
import { IIsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GmxV2Library } from "@dolomite-exchange/modules-gmx-v2/contracts/GmxV2Library.sol";
import { IGmxV2IsolationModeVaultFactory } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";
import { GlvLibrary } from "./GlvLibrary.sol";
import { IGlvIsolationModeUnwrapperTraderV2 } from "./interfaces/IGlvIsolationModeUnwrapperTraderV2.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
import { GlvWithdrawal } from "./lib/GlvWithdrawal.sol";
// solhint-enable max-line-length


/**
 * @title   GlvIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GLV (via withdrawing from GMX)
 */
contract GlvIsolationModeUnwrapperTraderV2 is
    IGlvIsolationModeUnwrapperTraderV2,
    UpgradeableAsyncIsolationModeUnwrapperTrader
{

    // =====================================================
    // ===================== Constants =====================
    // =====================================================

    bytes32 private constant _FILE = "GlvIsolationModeUnwrapperV2";
    bytes32 private constant _SKIP_LONG_TOKEN = bytes32(uint256(keccak256("eip1967.proxy.skipLongToken")) - 1);

    // =====================================================
    // ===================== Modifiers =====================
    // =====================================================

    modifier onlyWrapperCaller(address _from) {
        _validateIsWrapper(_from);
        _;
    }

    // =====================================================
    // ==================== Constructor ====================
    // =====================================================

    constructor(address _weth) AsyncIsolationModeTraderBase(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _glvRegistry,
        bool _skipLongToken
    )
    external initializer {
        _initializeUnwrapperTrader(_dGM, _glvRegistry, _dolomiteMargin);
        _setUint256(_SKIP_LONG_TOKEN, _skipLongToken ? 1 : 0);
    }

    function vaultInitiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) external payable {
        IGlvIsolationModeVaultFactory factory = IGlvIsolationModeVaultFactory(address(VAULT_FACTORY()));
        _validateVaultExists(factory, /* _vault = */ msg.sender);

        bytes32 withdrawalKey = GlvLibrary.unwrapperExecuteInitiateUnwrapping(
            factory,
            /* _vault = */ msg.sender,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            msg.value,
            _extraData
        );

        _vaultCreateWithdrawalInfo(
            withdrawalKey,
            /* _vault = */ msg.sender,
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function initiateCancelWithdrawal(bytes32 _key) external {
        GlvLibrary.unwrapperInitiateCancelWithdrawal(/* _unwrapper = */ this, _key);
    }

    function handleCallbackFromWrapperBefore() external onlyWrapperCaller(msg.sender) {
        _handleCallbackBefore();
    }

    function handleCallbackFromWrapperAfter() external onlyWrapperCaller(msg.sender) {
        _handleCallbackAfter();
    }

    function afterGlvWithdrawalExecution(
        bytes32 _key,
        GlvWithdrawal.Props memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    nonReentrant
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = getWithdrawalInfo(_key);
        _validateWithdrawalExists(withdrawalInfo);

        GmxEventUtils.UintKeyValue memory outputTokenAmount = _eventData.uintItems.items[0];
        GmxEventUtils.UintKeyValue memory secondaryOutputTokenAmount = _eventData.uintItems.items[1];
        GlvLibrary.validateEventDataForWithdrawal(
            IGlvIsolationModeVaultFactory(address(VAULT_FACTORY())),
            _withdrawal.numbers.glvTokenAmount,
            /* _outputTokenAddress = */ _eventData.addressItems.items[0],
            outputTokenAmount,
            /* _secondaryOutputTokenAddress = */ _eventData.addressItems.items[1],
            secondaryOutputTokenAmount,
            withdrawalInfo
        );

        // Save the output amount so we can refer to it later. This also enables it to be retried if execution fails
        withdrawalInfo.outputAmount = outputTokenAmount.value + secondaryOutputTokenAmount.value;
        withdrawalInfo.isRetryable = true;
        AsyncIsolationModeUnwrapperTraderImpl.setWithdrawalInfo(_getStorageSlot(), _key, withdrawalInfo);

        _executeWithdrawal(withdrawalInfo);
    }

    /**
     * @dev Funds will automatically be sent back to the vault by GMX
     */
    function afterGlvWithdrawalCancellation(
        bytes32 _key,
        GlvWithdrawal.Props memory /* _withdrawal */,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    nonReentrant
    onlyHandler(msg.sender) {
        _executeWithdrawalCancellation(_key);
    }

    function isValidOutputToken(
        address _outputToken
    )
    public
    view
    virtual
    override(UpgradeableAsyncIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTraderV2)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _outputToken,
            skipLongToken()
        );
    }

    function skipLongToken() public view returns (bool) {
        return _getUint256(_SKIP_LONG_TOKEN) == 1;
    }

    function GLV_REGISTRY() public view returns (IGlvRegistry) {
        return IGlvRegistry(address(HANDLER_REGISTRY()));
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _executeWithdrawal(WithdrawalInfo memory _withdrawalInfo) internal override {
        _handleCallbackBefore();
        super._executeWithdrawal(_withdrawalInfo);
        _handleCallbackAfter();
    }

    function _validateIsBalanceSufficient(uint256 /* _inputAmount */) internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Do nothing
    }

    function _validateIsWrapper(address _from) internal view {
        Require.that(
            _from == address(_getWrapperTrader()),
            _FILE,
            "Caller can only be wrapper",
            _from
        );
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
