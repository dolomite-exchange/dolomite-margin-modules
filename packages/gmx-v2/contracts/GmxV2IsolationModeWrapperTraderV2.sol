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
import { GmxV2Library } from "./GmxV2Library.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "./interfaces/IGmxV2IsolationModeWrapperTraderV2.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
import { GmxDeposit } from "./lib/GmxDeposit.sol";
import { GmxEventUtils } from "./lib/GmxEventUtils.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GM tokens (via depositing into GMX)
 */
contract GmxV2IsolationModeWrapperTraderV2 is
    IGmxV2IsolationModeWrapperTraderV2,
    UpgradeableAsyncIsolationModeWrapperTrader
{

    // =====================================================
    // ===================== Constants =====================
    // =====================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";

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
    ) external initializer {
        _initializeWrapperTrader(_dGM, _gmxV2Registry, _dolomiteMargin);
    }

    function afterDepositExecution(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    onlyHandler(msg.sender) {
        GmxEventUtils.UintKeyValue memory receivedMarketTokens = _eventData.uintItems.items[0];
        Require.that(
            keccak256(abi.encodePacked(receivedMarketTokens.key))
                == keccak256(abi.encodePacked("receivedMarketTokens")),
            _FILE,
            "Unexpected receivedMarketTokens"
        );

        _executeDepositExecution(_key, receivedMarketTokens.value, _deposit.numbers.minMarketTokens);
    }

    /**
     *
     * @dev  This contract is designed to work with 1 token. If a GMX deposit is cancelled,
     *       any excess tokens other than the inputToken will be stuck in the contract
     */
    function afterDepositCancellation(
        bytes32 _key,
        GmxDeposit.DepositProps memory /* _deposit */,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        depositInfo.isRetryable = true;
        AsyncIsolationModeWrapperTraderImpl.setDepositInfo(_getStorageSlot(), _key, depositInfo);

        _executeDepositCancellation(depositInfo);
    }

    function initiateCancelDeposit(bytes32 _key) external {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        Require.that(
            msg.sender == depositInfo.vault || isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        GMX_REGISTRY_V2().gmxExchangeRouter().cancelDeposit(_key);
    }

    function isValidInputToken(
        address _inputToken
    )
    public
    view
    override(UpgradeableAsyncIsolationModeWrapperTrader, IIsolationModeWrapperTraderV2)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _inputToken
        );
    }

    function GMX_REGISTRY_V2() public view returns (IGmxV2Registry) {
        return IGmxV2Registry(address(HANDLER_REGISTRY()));
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
        return GmxV2Library.wrapperCreateDeposit(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            GMX_REGISTRY_V2(),
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
