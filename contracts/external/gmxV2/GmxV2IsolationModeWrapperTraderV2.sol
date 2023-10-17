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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";
import { GmxDeposit } from "../interfaces/gmx/GmxDeposit.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { IGmxDepositCallbackReceiver } from "../interfaces/gmx/IGmxDepositCallbackReceiver.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { UpgradeableIsolationModeWrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeWrapperTrader.sol";


/**
 * @title   GmxV2IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GM tokens (via depositing into GMX)
 */
contract GmxV2IsolationModeWrapperTraderV2 is
    IGmxV2IsolationModeWrapperTraderV2,
    IGmxDepositCallbackReceiver,
    UpgradeableIsolationModeWrapperTrader,
    GmxV2IsolationModeTraderBase
{
    using InterestIndexLib for IDolomiteMargin;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    bytes32 private constant _DEPOSIT_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.depositInfo")) - 1);

    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
        // @audit - should we bother validating it comes from WETH or the router? We don't have much contract space
        //          to work with (we're up against the 24.5kb limit)
    }

    // ============ Initializer ============

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _gmxRegistryV2,
        address _weth
    ) external initializer {
        _initializeWrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth);
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
        Require.that(
            depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        // @follow-up Switched to use 0 instead of len-1
        // @audit Don't use len - 1 but use index value
        GmxEventUtils.UintKeyValue memory receivedMarketTokens = _eventData.uintItems.items[0];
        Require.that(
            keccak256(abi.encodePacked(receivedMarketTokens.key))
                == keccak256(abi.encodePacked("receivedMarketTokens")),
            _FILE,
            "Unexpected receivedMarketTokens"
        );

        IERC20 underlyingToken = IERC20(VAULT_FACTORY().UNDERLYING_TOKEN());
        // We just need to blind transfer the min amount to the vault
        underlyingToken.safeTransfer(depositInfo.vault, _deposit.numbers.minMarketTokens);

        if (receivedMarketTokens.value > _deposit.numbers.minMarketTokens) {
            // We need to
            // 1) send the diff into the vault via `operate` and
            // 2) blind transfer the min token amount to the vault
            uint256 diff = receivedMarketTokens.value - _deposit.numbers.minMarketTokens;

            // The allowance is entirely spent in the call to `factory.depositIntoDolomiteMarginFromTokenConverter` or
            // `_depositIntoDefaultPositionAndClearDeposit`
            underlyingToken.safeApprove(depositInfo.vault, diff);

            // @audit   The only way this try-catch should throw is if there wasn't enough gas passed into the callback
            //          gas limit or if the user is underwater (after the deposit settles). We should always pass enough
            //          gas, though. If the user goes underwater, we'll want to recover as reasonably as possible. The
            //          way we do this is by initiating an unwrapping & then a liquidation via
            //          `IsolationModeFreezableLiquidatorProxy.sol`
            // @audit   This can also fail if the user pushes the GM token total supply on Dolomite past our supply cap
            //          How do we mitigate this? We don't know ahead of time how many tokens the user will get...
            // @audit   Are there any other "reasons" that the try-catch can fail that I'm missing here?
            IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
            try
                factory.depositIntoDolomiteMarginFromTokenConverter(
                    depositInfo.vault,
                    depositInfo.accountNumber,
                    diff
                )
            {
                _clearDepositAndSetVaultFrozenStatus(depositInfo);
                emit DepositExecuted(_key);
            } catch Error(string memory _reason) {
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
                emit DepositFailed(_key, _reason);
            } catch (bytes memory /* _reason */) {
                _depositIntoDefaultPositionAndClearDeposit(factory, depositInfo, diff);
                emit DepositFailed(_key, "");
            }
        } else {
            // There's nothing additional to send to the vault; clear out the deposit
            _clearDepositAndSetVaultFrozenStatus(depositInfo);
            emit DepositExecuted(_key);
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
        Require.that(
            depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        assert(_deposit.numbers.initialLongTokenAmount == 0 || _deposit.numbers.initialShortTokenAmount == 0);

        factory.setShouldSkipTransfer(depositInfo.vault, /* _shouldSkipTransfer = */ true);

        try GmxV2Library.swapExactInputForOutputForDepositCancellation(/* _wrapper = */ this, depositInfo) {
            // The deposit info is set via `setDepositInfoAndSetVaultFrozenStatus` by the unwrapper
            emit DepositCancelled(_key);
        } catch Error(string memory _reason) {
            emit DepositCancelledFailed(_key, _reason);
        } catch (bytes memory /* _reason */) {
            emit DepositCancelledFailed(_key, "");

        }
    }

    function cancelDeposit(bytes32 _key) external {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        Require.that(
            msg.sender == depositInfo.vault || isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        GMX_REGISTRY_V2().gmxExchangeRouter().cancelDeposit(_key);
    }

    function setDepositInfoAndSetVaultFrozenStatus(
        bytes32 _key,
        DepositInfo calldata _depositInfo
    ) external {
        Require.that(
            msg.sender == address(GMX_REGISTRY_V2().gmxV2UnwrapperTrader()),
            _FILE,
            "Caller is not unwrapper",
            msg.sender
        );
        _setDepositInfoAndSetVaultFrozenStatus(_key, _depositInfo);
    }

    function isValidInputToken(
        address _inputToken
    )
    public
    view
    override(UpgradeableIsolationModeWrapperTrader, IIsolationModeWrapperTrader)
    returns (bool) {
        return GmxV2Library.isValidInputOrOutputToken(
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())),
            _inputToken
        );
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
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));

        // Account number is set by the Token Vault so we know it's safe to use
        (uint256 accountNumber, uint256 ethExecutionFee) = abi.decode(_extraOrderData, (uint256, uint256));

        // Disallow the deposit if there's already an action waiting for it
        GmxV2Library.checkVaultAccountIsNotFrozen(factory, _tradeOriginator, accountNumber);

        bytes32 depositKey;
        {
            // New scope for the "stack too deep" error
            address tradeOriginatorForStackTooDeep = _tradeOriginator;
            address outputTokenUnderlyingForStackTooDeep = _outputTokenUnderlying;
            uint256 minOutputAmountForStackTooDeep = _minOutputAmount;
            address inputTokenForStackTooDeep = _inputToken;
            uint256 inputAmountForStackTooDeep = _inputAmount;
            depositKey = GmxV2Library.createDeposit(
                factory,
                GMX_REGISTRY_V2(),
                WETH(),
                tradeOriginatorForStackTooDeep,
                ethExecutionFee,
                outputTokenUnderlyingForStackTooDeep,
                minOutputAmountForStackTooDeep,
                inputTokenForStackTooDeep,
                inputAmountForStackTooDeep
            );
        }

        _setDepositInfoAndSetVaultFrozenStatus(
            depositKey,
            DepositInfo({
                key: depositKey,
                vault: _tradeOriginator,
                accountNumber: accountNumber,
                inputToken: _inputToken,
                inputAmount: _inputAmount,
                outputAmount: _minOutputAmount
            })
        );
        emit DepositCreated(depositKey);

        factory.setShouldSkipTransfer(
            _tradeOriginator,
            /* _shouldSkipTransfer = */ true
        );
        return _minOutputAmount;
    }

    function _depositIntoDefaultPositionAndClearDeposit(
        IGmxV2IsolationModeVaultFactory _factory,
        DepositInfo memory _depositInfo,
        uint256 _depositAmountWei
    ) internal {
        uint256 marketId = _factory.marketId();
        uint256 maxWei = DOLOMITE_MARGIN().getMarketMaxWei(marketId).value;
        IDolomiteStructs.Par memory supplyPar = IDolomiteStructs.Par({
            sign: true,
            value: DOLOMITE_MARGIN().getMarketTotalPar(marketId).supply
        });

        if (DOLOMITE_MARGIN().parToWei(marketId, supplyPar).value + _depositAmountWei >= maxWei && maxWei != 0) {
            // If the supplyPar is gte than the maxWei, then we should to transfer the deposit to the vault owner. It's
            // better to do this than to revert, since the user will be able to maintain control over the assets.
            IERC20 underlyingToken = IERC20(_factory.UNDERLYING_TOKEN());
            underlyingToken.safeTransfer(_factory.getAccountByVault(_depositInfo.vault), _depositAmountWei);
            // Reset the allowance to 0 since it won't be used
            underlyingToken.safeApprove(_depositInfo.vault, 0);
        } else {
            _factory.depositIntoDolomiteMarginFromTokenConverter(
                _depositInfo.vault,
                _DEFAULT_ACCOUNT_NUMBER,
                _depositAmountWei
            );
        }

        _clearDepositAndSetVaultFrozenStatus(_depositInfo);
    }

    function _clearDepositAndSetVaultFrozenStatus(
        DepositInfo memory _depositInfo
    ) internal {
        _setDepositInfoAndSetVaultFrozenStatus(
            _depositInfo.key,
            _emptyDepositInfo(_depositInfo.key, _depositInfo.vault, _depositInfo.accountNumber)
        );
    }

    function _setDepositInfoAndSetVaultFrozenStatus(bytes32 _key, DepositInfo memory _info) internal {
        bool clearValues = _info.outputAmount == 0;
        DepositInfo storage storageInfo = _getDepositSlot(_key);
        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).setIsVaultAccountFrozen(
            _info.vault,
            _info.accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Deposit,
            /* _amountWei = */ _info.outputAmount
        );
        storageInfo.key = _key;
        storageInfo.vault = clearValues ? address(0) : _info.vault;
        storageInfo.accountNumber = clearValues ? 0 : _info.accountNumber;
        storageInfo.inputToken = clearValues ? address(0) : _info.inputToken;
        storageInfo.inputAmount = clearValues ? 0 : _info.inputAmount;
        storageInfo.outputAmount = clearValues ? 0 : _info.outputAmount;
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

    function _emptyDepositInfo(
        bytes32 _key,
        address _vault,
        uint256 _accountNumber
    ) internal pure returns (DepositInfo memory _depositInfo) {
        _depositInfo.key = _key;
        _depositInfo.vault = _vault;
        _depositInfo.accountNumber = _accountNumber;
    }
}
