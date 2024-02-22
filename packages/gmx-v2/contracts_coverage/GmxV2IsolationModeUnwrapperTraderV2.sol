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
import { GmxV2Library } from "./GmxV2Library.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "./interfaces/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
import { GmxEventUtils } from "./lib/GmxEventUtils.sol";
import { GmxWithdrawal } from "./lib/GmxWithdrawal.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GM (via withdrawing from GMX)
 */
contract GmxV2IsolationModeUnwrapperTraderV2 is
    IGmxV2IsolationModeUnwrapperTraderV2,
    UpgradeableAsyncIsolationModeUnwrapperTrader
{

    // =====================================================
    // ===================== Constants =====================
    // =====================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeUnwrapperV2";

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
        address _gmxV2Registry
    )
    external initializer {
        _initializeUnwrapperTrader(_dGM, _gmxV2Registry, _dolomiteMargin);
    }

    function vaultInitiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) external payable {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        address vault = msg.sender;
        _validateVaultExists(factory, vault);

        bytes32 withdrawalKey = GmxV2Library.executeInitiateUnwrapping(
            factory,
            vault,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            msg.value,
            _extraData
        );

        _vaultCreateWithdrawalInfo(
            withdrawalKey,
            vault,
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function initiateCancelWithdrawal(bytes32 _key) external {
        GmxV2Library.initiateCancelWithdrawal(/* _unwrapper = */ this, _key);
    }

    function handleCallbackFromWrapperBefore() external onlyWrapperCaller(msg.sender) {
        _handleCallbackBefore();
    }

    function handleCallbackFromWrapperAfter() external onlyWrapperCaller(msg.sender) {
        _handleCallbackAfter();
    }

    function afterWithdrawalExecution(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    nonReentrant
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        _validateWithdrawalExists(withdrawalInfo);
        if (_withdrawal.numbers.marketTokenAmount >= withdrawalInfo.inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _withdrawal.numbers.marketTokenAmount >= withdrawalInfo.inputAmount,
            _FILE,
            "Invalid market token amount"
        );

        GmxEventUtils.UintKeyValue memory outputTokenAmount = _eventData.uintItems.items[0];
        GmxEventUtils.UintKeyValue memory secondaryOutputTokenAmount = _eventData.uintItems.items[1];
        GmxV2Library.validateEventDataForWithdrawal(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
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
    function afterWithdrawalCancellation(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory /* _withdrawal */,
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
    override(UpgradeableAsyncIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTraderV2)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _outputToken
        );
    }

    function GMX_REGISTRY_V2() public view returns (IGmxV2Registry) {
        return IGmxV2Registry(address(HANDLER_REGISTRY()));
    }

    function getWithdrawalInfo(bytes32 _key) public view returns (WithdrawalInfo memory) {
        return _getWithdrawalSlot(_key);
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
        if (_from == address(_getWrapperTrader())) { /* FOR COVERAGE TESTING */ }
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
