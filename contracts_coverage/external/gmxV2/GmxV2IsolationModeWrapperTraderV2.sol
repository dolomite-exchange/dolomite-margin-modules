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
import { GmxV2IsolationModeTraderBase } from "./GmxV2IsolationModeTraderBase.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { GmxDeposit } from "../interfaces/gmx/GmxDeposit.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { IGmxDepositCallbackReceiver } from "../interfaces/gmx/IGmxDepositCallbackReceiver.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { UpgradeableIsolationModeWrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeWrapperTrader.sol";


/**
 * @title   GmxV2IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GM tokens (via depositing into GMX)
 */
contract GmxV2IsolationModeWrapperTraderV2 is
    UpgradeableIsolationModeWrapperTrader,
    GmxV2IsolationModeTraderBase,
    IGmxV2IsolationModeWrapperTraderV2,
    IGmxDepositCallbackReceiver
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    bytes32 private constant _DEPOSIT_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.depositInfo")) - 1);

    receive() external payable {} // solhint-disable-line no-empty-blocks

    // ============ Initializer ============

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _gmxRegistryV2,
        address _weth,
        uint256 _callbackGasLimit
    ) external initializer {
        _initializeWrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth, _callbackGasLimit);
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
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        if (depositInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        // @follow-up Switched to use 0 instead of len-1
        // @audit Don't use len - 1 but use index value
        GmxEventUtils.UintKeyValue memory receivedMarketTokens = _eventData.uintItems.items[0];
        if (keccak256(abi.encodePacked(receivedMarketTokens.key))== keccak256(abi.encodePacked("receivedMarketTokens"))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(receivedMarketTokens.key))
                == keccak256(abi.encodePacked("receivedMarketTokens")),
            _FILE,
            "Unexpected receivedMarketTokens"
        );

        IERC20 underlyingToken = IERC20(VAULT_FACTORY().UNDERLYING_TOKEN());
        // We just need to blind transfer the min amount to the vault
        underlyingToken.safeTransfer(depositInfo.vault, _deposit.numbers.minMarketTokens);

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        if (receivedMarketTokens.value > _deposit.numbers.minMarketTokens) {
            // We need to send the diff into the vault via `operate` and blind transfer the min token amount
            uint256 diff = receivedMarketTokens.value - _deposit.numbers.minMarketTokens;

            // The allowance is entirely spent in the call to `factory.depositIntoDolomiteMarginFromTokenConverter` or
            // `_depositIntoDefaultPositionAndClearDeposit`
            underlyingToken.safeApprove(depositInfo.vault, diff);

            // @audit   The only way this try-catch should throw is if there wasn't enough gas passed into the callback
            //          gas limit or if the user is underwater (after the deposit settles). We should always pass enough
            //          gas, though. If the user goes underwater, we'll want to recover as reasonably as possible. The
            //          way we do this is by initiating an unwrapping & then a liquidation via
            //          `IsolationModeFreezableLiquidatorProxy.sol`
            // @audit   Are there any other "reasons" that the try-catch can fail that I'm missing here?
            try
                factory.depositIntoDolomiteMarginFromTokenConverter(
                    depositInfo.vault,
                    depositInfo.accountNumber,
                    diff
                )
            {
                _clearDeposit(factory, depositInfo);
            } catch Error(string memory reason) {
                emit DepositFailed(_key, reason);
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
            } catch (bytes memory /* reason */) {
                emit DepositFailed(_key, "");
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
            }
        } else {
            // There's nothing additional to send to the vault; clear out the deposit
            _clearDeposit(factory, depositInfo);
        }
    }

    function afterDepositCancellation(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    onlyHandler(msg.sender) {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        if (depositInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        /*assert(_deposit.numbers.initialLongTokenAmount == 0 || _deposit.numbers.initialShortTokenAmount == 0);*/

        if (_deposit.numbers.initialLongTokenAmount > 0) {
            _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                _deposit.addresses.initialLongToken,
                _deposit.numbers.initialLongTokenAmount,
                depositInfo,
                factory
            );
        } else {
            _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                _deposit.addresses.initialShortToken,
                _deposit.numbers.initialShortTokenAmount,
                depositInfo,
                factory
            );
        }

        // Burn the GM tokens that were virtually minted to the vault, since the deposit was cancelled
        factory.setShouldSkipTransfer(depositInfo.vault, /* _shouldSkipTransfer = */ true);
        factory.withdrawFromDolomiteMarginFromTokenConverter(
            depositInfo.vault,
            depositInfo.accountNumber,
            _deposit.numbers.minMarketTokens
        );

        factory.setIsVaultFrozen(depositInfo.vault, /* _isVaultFrozen = */ false);
        _setDepositInfo(_key, _emptyDepositInfo());
        emit DepositCancelled(_key);
    }

    function cancelDeposit(bytes32 _key) external {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        if (msg.sender == depositInfo.vault || isHandler(msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(msg.sender == depositInfo.vault || isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        GMX_REGISTRY_V2().gmxExchangeRouter().cancelDeposit(_key);
    }

    function isValidInputToken(address _inputToken) public view override returns (bool) {
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).LONG_TOKEN();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).SHORT_TOKEN();
        return _inputToken == longToken || _inputToken == shortToken;
    }

    function getDepositInfo(bytes32 _key) public pure returns (DepositInfo memory) {
        return _getDepositSlot(_key);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address /* _receiver */,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
    internal
    override
    returns (uint256) {
        // Account number is set by the Token Vault so we know it's safe to use
        (uint256 accountNumber, uint256 ethExecutionFee) = abi.decode(_extraOrderData, (uint256, uint256));

        // Disallow the withdrawal if there's already an action waiting for it
        GmxV2Library.checkVaultIsNotActive(GMX_REGISTRY_V2(), _tradeOriginator, accountNumber);

        address tradeOriginatorForStackTooDeep = _tradeOriginator;
        IGmxExchangeRouter exchangeRouter = GMX_REGISTRY_V2().gmxExchangeRouter();
        WETH().safeTransferFrom(tradeOriginatorForStackTooDeep, address(this), ethExecutionFee);
        WETH().withdraw(ethExecutionFee);

        {
            address depositVault = GMX_REGISTRY_V2().gmxDepositVault();
            exchangeRouter.sendWnt{value: ethExecutionFee}(depositVault, ethExecutionFee);
            IERC20(_inputToken).safeApprove(address(GMX_REGISTRY_V2().gmxRouter()), _inputAmount);
            exchangeRouter.sendTokens(_inputToken, depositVault, _inputAmount);
        }

        {
            IGmxExchangeRouter.CreateDepositParams memory depositParams = IGmxExchangeRouter.CreateDepositParams(
                /* receiver = */ address(this),
                /* callbackContract = */ address(this),
                /* uiFeeReceiver = */ address(0),
                /* market = */ _outputTokenUnderlying,
                /* initialLongToken = */ IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).LONG_TOKEN(),
                /* initialShortToken = */ IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).SHORT_TOKEN(),
                /* longTokenSwapPath = */ new address[](0),
                /* shortTokenSwapPath = */ new address[](0),
                /* minMarketTokens = */ _minOutputAmount,
                /* shouldUnwrapNativeToken = */ false,
                /* executionFee = */ ethExecutionFee,
                /* callbackGasLimit = */ _getUint256(_CALLBACK_GAS_LIMIT_SLOT)
            );

            bytes32 depositKey = exchangeRouter.createDeposit(depositParams);
            _setDepositInfo(depositKey, DepositInfo({
                key: depositKey,
                vault: tradeOriginatorForStackTooDeep,
                accountNumber: accountNumber,
                outputAmount: _minOutputAmount
            }));
            emit DepositCreated(depositKey);
        }

        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).setIsVaultFrozen(
            tradeOriginatorForStackTooDeep,
            /* _isVaultFrozen = */ true
        );
        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).setShouldSkipTransfer(
            tradeOriginatorForStackTooDeep,
            /* _shouldSkipTransfer = */ true
        );
        return _minOutputAmount;
    }

    function _depositIntoDefaultPositionAndClearDeposit(
        IGmxV2IsolationModeVaultFactory _factory,
        DepositInfo memory _depositInfo,
        uint256 _depositAmountWei
    ) internal {
        _factory.depositIntoDolomiteMarginFromTokenConverter(
            _depositInfo.vault,
            _DEFAULT_ACCOUNT_NUMBER,
            _depositAmountWei
        );
        _clearDeposit(_factory, _depositInfo);
    }

    function _clearDeposit(
        IGmxV2IsolationModeVaultFactory _factory,
        DepositInfo memory _depositInfo
    ) internal {
        _factory.setIsVaultFrozen(_depositInfo.vault, /* _isVaultFrozen = */ false);
        _setDepositInfo(_depositInfo.key, _emptyDepositInfo());
        emit DepositExecuted(_depositInfo.key);
    }

    function _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _token,
        uint256 _amount,
        DepositInfo memory _info,
        IGmxV2IsolationModeVaultFactory factory
    ) internal {
        IERC20(_token).safeApprove(address(factory), _amount);
        factory.depositOtherTokenIntoDolomiteMarginFromTokenConverter(
            _info.vault,
            _info.accountNumber,
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token),
            _amount
        );
    }

    function _setDepositInfo(bytes32 _key, DepositInfo memory _info) internal {
        DepositInfo storage storageInfo = _getDepositSlot(_key);
        GMX_REGISTRY_V2().setIsAccountWaitingForCallback(
            storageInfo.vault,
            storageInfo.accountNumber,
            _info.vault != address(0)
        );
        storageInfo.key = _key;
        storageInfo.vault = _info.vault;
        storageInfo.accountNumber = _info.accountNumber;
        storageInfo.outputAmount = _info.outputAmount;
    }

    function _approveIsolationModeTokenForTransfer(
        address _vault,
        address _receiver,
        uint256 _amount
    )
    internal
    override {
        VAULT_FACTORY().enqueueTransferIntoDolomiteMargin(_vault, _amount);
        IERC20(address(VAULT_FACTORY())).safeApprove(_receiver, _amount);
    }

    function _getDepositSlot(bytes32 _key) internal pure returns (DepositInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_DEPOSIT_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
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

    function _emptyDepositInfo() internal pure returns (DepositInfo memory) {
        return DepositInfo({
            key: bytes32(0),
            vault: address(0),
            accountNumber: 0,
            outputAmount: 0
        });
    }
}
