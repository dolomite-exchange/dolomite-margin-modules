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
import { GmxV2Library } from "./GmxV2Library.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";
import { GmxDeposit } from "../interfaces/gmx/GmxDeposit.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { IGmxV2Registry } from "../interfaces/gmx/IGmxV2Registry.sol";
import { UpgradeableAsyncIsolationModeWrapperTrader } from "../proxies/abstract/UpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length


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
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";

    // ============ Initializer ============

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _gmxV2Registry,
        address _weth
    ) external initializer {
        _initializeWrapperTrader(_dGM, _dolomiteMargin);
        _initializeAsyncTraderBase(_gmxV2Registry, _weth);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function afterDepositExecution(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    onlyHandler(msg.sender) {
        // @follow-up Switched to use 0 instead of len-1
        // @audit Don't use len - 1 but use index value
        GmxEventUtils.UintKeyValue memory receivedMarketTokens = _eventData.uintItems.items[0];
        Require.that(
            keccak256(abi.encodePacked(receivedMarketTokens.key))
                == keccak256(abi.encodePacked("receivedMarketTokens")),
            _FILE,
            "Unexpected receivedMarketTokens"
        );

        _executeDepositExecution(_key, receivedMarketTokens.value, _deposit.numbers.minMarketTokens);
    }

    function afterDepositCancellation(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    onlyHandler(msg.sender) {
        assert(_deposit.numbers.initialLongTokenAmount == 0 || _deposit.numbers.initialShortTokenAmount == 0);

        DepositInfo memory depositInfo = _getDepositSlot(_key);
        _executeDepositCancellation(depositInfo);
    }

    function executeDepositCancellationForRetry(
        bytes32 _key
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        Require.that(
            depositInfo.isRetryable,
            _FILE,
            "Deposit is not retryable"
        );

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

    function setDepositInfoAndReducePendingAmountFromUnwrapper(
        bytes32 _key,
        uint256 _outputAmountDeltaWei,
        DepositInfo calldata _depositInfo
    ) external {
        Require.that(
            msg.sender == address(HANDLER_REGISTRY().getUnwrapperByToken(VAULT_FACTORY())),
            _FILE,
            "Only unwrapper can call",
            msg.sender
        );
        _setDepositInfo(_key, _depositInfo);
        _updateVaultPendingAmount(
            _depositInfo.vault,
            _depositInfo.accountNumber,
            _outputAmountDeltaWei,
            /* _isPositive = */ false
        );
    }

    function isValidInputToken(
        address _inputToken
    )
    public
    view
    override(UpgradeableAsyncIsolationModeWrapperTrader, IIsolationModeWrapperTrader)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _inputToken
        );
    }

    function GMX_REGISTRY_V2() public view returns (IGmxV2Registry) {
        return IGmxV2Registry(address(HANDLER_REGISTRY()));
    }

    function getDepositInfo(bytes32 _key) public pure returns (DepositInfo memory) {
        return _getDepositSlot(_key);
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
        return GmxV2Library.createDeposit(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            GMX_REGISTRY_V2(),
            WETH(),
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
