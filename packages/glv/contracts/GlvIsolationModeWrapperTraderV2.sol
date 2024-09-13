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
import { UpgradeableAsyncIsolationModeWrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/UpgradeableAsyncIsolationModeWrapperTrader.sol";
import { AsyncIsolationModeWrapperTraderImpl } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/impl/AsyncIsolationModeWrapperTraderImpl.sol";
import { IIsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeWrapperTraderV2.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GmxV2Library } from "@dolomite-exchange/modules-gmx-v2/contracts/GmxV2Library.sol";
import { IGmxV2IsolationModeVaultFactory } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";
import { GlvLibrary } from "./GlvLibrary.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvIsolationModeWrapperTraderV2 } from "./interfaces/IGlvIsolationModeWrapperTraderV2.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
import { GlvDeposit } from "./lib/GlvDeposit.sol";
// solhint-enable max-line-length


/**
 * @title   GlvIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GLV tokens (via depositing into GMX)
 */
contract GlvIsolationModeWrapperTraderV2 is
    IGlvIsolationModeWrapperTraderV2,
    UpgradeableAsyncIsolationModeWrapperTrader
{

    // =====================================================
    // ===================== Constants =====================
    // =====================================================

    bytes32 private constant _FILE = "GlvIsolationModeWrapperV2";
    bytes32 private constant _SKIP_LONG_TOKEN = bytes32(uint256(keccak256("eip1967.proxy.skipLongToken")) - 1);

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
        address _gmxV2Registry,
        bool _skipLongToken
    ) external initializer {
        _initializeWrapperTrader(_dGM, _gmxV2Registry, _dolomiteMargin);
        _setUint256(_SKIP_LONG_TOKEN, _skipLongToken ? 1 : 0);
    }

    function afterGlvDepositExecution(
        bytes32 _key,
        GlvDeposit.Props memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    onlyHandler(msg.sender) {
        GmxEventUtils.UintKeyValue memory receivedGlvTokens = _eventData.uintItems.items[0];
        Require.that(
            keccak256(abi.encodePacked(receivedGlvTokens.key))
                == keccak256(abi.encodePacked("receivedGlvTokens")),
            _FILE,
            "Unexpected receivedGlvTokens"
        );

        _executeDepositExecution(_key, receivedGlvTokens.value, _deposit.numbers.minGlvTokens);
    }

    /**
     *
     * @dev  This contract is designed to work with 1 token. If a GMX deposit is cancelled,
     *       any excess tokens other than the inputToken will be stuck in the contract
     */
    function afterGlvDepositCancellation(
        bytes32 _key,
        GlvDeposit.Props memory /* _deposit */,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = getDepositInfo(_key);
        depositInfo.isRetryable = true;
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _key, depositInfo);

        _executeDepositCancellation(depositInfo);
    }

    function initiateCancelDeposit(bytes32 _key) external {
        GlvLibrary.initiateCancelDeposit(/* _wrapper = */ this, _key);
    }

    function isValidInputToken(
        address _inputToken
    )
    public
    view
    virtual
    override(UpgradeableAsyncIsolationModeWrapperTrader, IIsolationModeWrapperTraderV2)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _inputToken,
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
    // ============ Internal Functions ============
    // ============================================

    function _createDepositWithExternalProtocol(
        address _vault,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) internal override returns (bytes32) {
        // New scope for the "stack too deep" error
        uint256 ethExecutionFee = abi.decode(_extraOrderData, (uint256));
        return GlvLibrary.wrapperCreateDeposit(
            IGlvIsolationModeVaultFactory(address(VAULT_FACTORY())),
            GLV_REGISTRY(),
            WETH,
            _vault,
            ethExecutionFee,
            _outputTokenUnderlying,
            _minOutputAmount,
            _inputToken,
            _inputAmount
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
    returns (uint256)
    {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
