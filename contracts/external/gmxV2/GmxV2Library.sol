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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUpgradeableProxy } from "../interfaces/IIsolationModeUpgradeableProxy.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxMarket } from "../interfaces/gmx/GmxMarket.sol";
import { GmxPrice } from "../interfaces/gmx/GmxPrice.sol";
import { IGmxDataStore } from "../interfaces/gmx/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { IGmxV2Registry } from "../interfaces/gmx/IGmxV2Registry.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   GmxV2Library
 * @author  Dolomite
 *
 * @notice  Library contract for the GmxV2IsolationModeTokenVaultV1 contract to reduce code size
 */
library GmxV2Library {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;
    using TypesLib for IDolomiteStructs.Par;

    // ==================================================================
    // ============================ Constants ===========================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2Library";
    bytes32 private constant _MAX_PNL_FACTOR_KEY = keccak256(abi.encode("MAX_PNL_FACTOR"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_ADL_KEY = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_ADL"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS")); // solhint-disable-line max-line-length
    bytes32 private constant _MAX_CALLBACK_GAS_LIMIT_KEY = keccak256(abi.encode("MAX_CALLBACK_GAS_LIMIT"));
    uint256 private constant _GMX_PRICE_DECIMAL_ADJUSTMENT = 6;
    uint256 private constant _GMX_PRICE_SCALE_ADJUSTMENT = 10 ** _GMX_PRICE_DECIMAL_ADJUSTMENT;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function createDeposit(
        IGmxV2IsolationModeVaultFactory _factory,
        IGmxV2Registry _registry,
        IWETH _weth,
        address _tradeOriginator,
        uint256 _ethExecutionFee,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount
    ) public returns (bytes32) {
        IGmxExchangeRouter exchangeRouter = _registry.gmxExchangeRouter();
        _weth.safeTransferFrom(_tradeOriginator, address(this), _ethExecutionFee);
        _weth.withdraw(_ethExecutionFee);

        address depositVault = _registry.gmxDepositVault();
        exchangeRouter.sendWnt{value: _ethExecutionFee}(depositVault, _ethExecutionFee);
        IERC20(_inputToken).safeApprove(address(_registry.gmxRouter()), _inputAmount);
        exchangeRouter.sendTokens(_inputToken, depositVault, _inputAmount);

        IGmxExchangeRouter.CreateDepositParams memory depositParams = IGmxExchangeRouter.CreateDepositParams(
            /* receiver = */ address(this),
            /* callbackContract = */ address(this),
            /* uiFeeReceiver = */ address(0),
            /* market = */ _outputTokenUnderlying,
            /* initialLongToken = */ _factory.LONG_TOKEN(),
            /* initialShortToken = */ _factory.SHORT_TOKEN(),
            /* longTokenSwapPath = */ new address[](0),
            /* shortTokenSwapPath = */ new address[](0),
            /* minMarketTokens = */ _minOutputAmount,
            /* shouldUnwrapNativeToken = */ false,
            /* executionFee = */ _ethExecutionFee,
            /* callbackGasLimit = */ _registry.callbackGasLimit()
        );

        return exchangeRouter.createDeposit(depositParams);
    }

    function validateAndExecuteInitiateUnwrapping(
        IGmxV2IsolationModeVaultFactory _factory,
        address _vault,
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        uint256 _ethExecutionFee,
        bool _isLiquidation
    ) public {
        // Disallow the withdrawal if there's already a withdrawal waiting for it or if we're attempting to OVER
        // withdraw. This can happen due to a pending deposit OR if the user inputs a number that's too large)
        _validateWithdrawalAmountForUnwrapping(
            _factory,
            _vault,
            _tradeAccountNumber,
            _inputAmount,
            _isLiquidation
        );

        IGmxV2Registry registry = _factory.gmxV2Registry();
        IGmxExchangeRouter exchangeRouter = registry.gmxExchangeRouter();
        address withdrawalVault = registry.gmxWithdrawalVault();

        address[] memory swapPath = new address[](1);
        swapPath[0] = _factory.UNDERLYING_TOKEN();

        exchangeRouter.sendWnt{value: _ethExecutionFee}(withdrawalVault, _ethExecutionFee);
        IERC20(swapPath[0]).safeApprove(address(registry.gmxRouter()), _inputAmount);
        exchangeRouter.sendTokens(swapPath[0], withdrawalVault, _inputAmount);

        IGmxV2IsolationModeUnwrapperTraderV2 unwrapper = registry.gmxV2UnwrapperTrader();
        IGmxExchangeRouter.CreateWithdrawalParams memory withdrawalParams = IGmxExchangeRouter.CreateWithdrawalParams(
            /* receiver = */ address(unwrapper),
            /* callbackContract = */ address(unwrapper),
            /* uiFeeReceiver = */ address(0),
            /* market = */ swapPath[0],
            /* longTokenSwapPath = */ _outputToken == _factory.LONG_TOKEN() ? new address[](0) : swapPath,
            /* shortTokenSwapPath = */ _outputToken == _factory.SHORT_TOKEN() ? new address[](0) : swapPath,
            /* minLongTokenAmount = */ _outputToken == _factory.LONG_TOKEN() ? _minOutputAmount : 0,
            /* minShortTokenAmount = */ _outputToken == _factory.SHORT_TOKEN() ? _minOutputAmount : 0,
            /* shouldUnwrapNativeToken = */ false,
            /* executionFee = */ _ethExecutionFee,
            /* callbackGasLimit = */ unwrapper.callbackGasLimit()
        );

        bytes32 withdrawalKey = exchangeRouter.createWithdrawal(withdrawalParams);
        unwrapper.vaultCreateWithdrawalInfo(
            withdrawalKey,
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount
        );
    }

    function depositAndApproveWethForWrapping(IGmxV2IsolationModeTokenVaultV1 _vault) public {
        Require.that(
            msg.value > 0,
            _FILE,
            "Invalid execution fee"
        );
        _vault.WETH().deposit{value: msg.value}();
        IERC20(address(_vault.WETH())).safeApprove(address(_vault.registry().gmxV2WrapperTrader()), msg.value);
    }

    function swapExactInputForOutputForWithdrawal(
        IGmxV2IsolationModeUnwrapperTraderV2 _unwrapper,
        IGmxV2IsolationModeUnwrapperTraderV2.WithdrawalInfo memory _withdrawalInfo
    ) public {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = _unwrapper.VAULT_FACTORY().marketId();
        marketIdsPath[1] = _unwrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_withdrawalInfo.outputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(this);

        IGmxV2IsolationModeUnwrapperTraderV2.TradeType[] memory tradeTypes = new IGmxV2IsolationModeUnwrapperTraderV2.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IGmxV2IsolationModeUnwrapperTraderV2.TradeType.FromWithdrawal;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _withdrawalInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None
        });

        IGmxV2IsolationModeTokenVaultV1(_withdrawalInfo.vault).swapExactInputForOutput(
            _withdrawalInfo.accountNumber,
            marketIdsPath,
            _withdrawalInfo.inputAmount,
            _withdrawalInfo.outputAmount,
            traderParams,
                /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
    }

    function swapExactInputForOutputForDepositCancellation(
        IGmxV2IsolationModeWrapperTraderV2 _wrapper,
        IGmxV2IsolationModeWrapperTraderV2.DepositInfo memory _depositInfo
    ) public {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = _wrapper.VAULT_FACTORY().marketId();
        marketIdsPath[1] = _wrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_depositInfo.inputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(_wrapper.GMX_REGISTRY_V2().gmxV2UnwrapperTrader());

        IGmxV2IsolationModeUnwrapperTraderV2.TradeType[] memory tradeTypes = new IGmxV2IsolationModeUnwrapperTraderV2.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IGmxV2IsolationModeUnwrapperTraderV2.TradeType.FromDeposit;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _depositInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None
        });

        uint256 outputAmount = _depositInfo.inputAmount;
        IERC20(_depositInfo.inputToken).safeApprove(traderParams[0].trader, outputAmount);

        IGmxV2IsolationModeUnwrapperTraderV2(traderParams[0].trader).handleGmxCallbackFromWrapperBefore();
        IGmxV2IsolationModeTokenVaultV1(_depositInfo.vault).swapExactInputForOutput(
            _depositInfo.accountNumber,
            marketIdsPath,
            /* _inputAmountWei = */ _depositInfo.outputAmount,
            outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
        IGmxV2IsolationModeUnwrapperTraderV2(traderParams[0].trader).handleGmxCallbackFromWrapperAfter();
    }
    
    function isValidInputOrOutputToken(
        IGmxV2IsolationModeVaultFactory _factory,
        address _token
    ) public view returns (bool) {
        return _token == _factory.LONG_TOKEN() || _token == _factory.SHORT_TOKEN();
    }

    function validateVirtualBalance(address _vault, uint256 _transferAmount) public view {
        uint256 underlyingVirtualBalance = IGmxV2IsolationModeTokenVaultV1(_vault).virtualBalance();
        Require.that(
            underlyingVirtualBalance >= _transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingVirtualBalance,
            _transferAmount
        );
    }

    function validateExecutionFee(
        IGmxV2IsolationModeTokenVaultV1 _vault,
        uint256 _toAccountNumber
    ) public view {
        address factory = IIsolationModeUpgradeableProxy(address(_vault)).vaultFactory();
        Require.that(
            msg.value == IGmxV2IsolationModeVaultFactory(factory).executionFee(),
            _FILE,
            "Invalid execution fee"
        );
        Require.that(
            _vault.getExecutionFeeForAccountNumber(_toAccountNumber) == 0,
            _FILE,
            "Execution fee already paid"
        );
    }

    function isExternalRedemptionPaused(
        IGmxV2Registry _registry,
        IDolomiteMargin _dolomiteMargin,
        IGmxV2IsolationModeVaultFactory _factory
    ) public view returns (bool) {
        address underlyingToken = _factory.UNDERLYING_TOKEN();
        IGmxDataStore dataStore = _registry.gmxDataStore();
        uint256 maxPnlForAdl = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_ADL_KEY, underlyingToken, /* _isLong = */ true)
        );
        uint256 maxPnlForWithdrawals = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, underlyingToken, /* _isLong = */ true)
        );

        GmxMarket.MarketPrices memory marketPrices = _getGmxMarketPrices(
            _dolomiteMargin.getMarketPrice(_factory.INDEX_TOKEN_MARKET_ID()).value,
            _dolomiteMargin.getMarketPrice(_factory.LONG_TOKEN_MARKET_ID()).value,
            _dolomiteMargin.getMarketPrice(_factory.SHORT_TOKEN_MARKET_ID()).value
        );

        int256 shortPnlToPoolFactor = _registry.gmxReader().getPnlToPoolFactor(
            dataStore,
            underlyingToken,
            marketPrices,
            /* _isLong = */ false,
            /* _maximize = */ true
        );
        int256 longPnlToPoolFactor = _registry.gmxReader().getPnlToPoolFactor(
            dataStore,
            underlyingToken,
            marketPrices,
            /* _isLong = */ true,
            /* _maximize = */ true
        );

        bool isShortPnlTooLarge =
            shortPnlToPoolFactor <= int256(maxPnlForAdl) && shortPnlToPoolFactor >= int256(maxPnlForWithdrawals);
        bool isLongPnlTooLarge =
            longPnlToPoolFactor <= int256(maxPnlForAdl) && longPnlToPoolFactor >= int256(maxPnlForWithdrawals);

        uint256 maxCallbackGasLimit = dataStore.getUint(_MAX_CALLBACK_GAS_LIMIT_KEY);

        return isShortPnlTooLarge || isLongPnlTooLarge || _registry.callbackGasLimit() > maxCallbackGasLimit;
    }

    function validateInitialMarketIds(
        uint256[] memory _marketIds,
        uint256 _longMarketId,
        uint256 _shortMarketId
    ) public pure {
        Require.that(
            _marketIds.length == 2,
            _FILE,
            "Invalid market IDs length"
        );
        Require.that(
            (_marketIds[0] == _longMarketId && _marketIds[1] == _shortMarketId)
            || (_marketIds[0] == _shortMarketId && _marketIds[1] == _longMarketId),
            _FILE,
            "Invalid market IDs"
        );
    }

    function validateEventDataForWithdrawal(
        GmxEventUtils.AddressKeyValue memory _outputTokenAddress,
        GmxEventUtils.UintKeyValue memory _outputTokenAmount,
        GmxEventUtils.AddressKeyValue memory _secondaryOutputTokenAddress,
        GmxEventUtils.UintKeyValue memory _secondaryOutputTokenAmount,
        IGmxV2IsolationModeUnwrapperTraderV2.WithdrawalInfo memory _withdrawalInfo
    ) public pure {
        Require.that(
            keccak256(abi.encodePacked(_outputTokenAddress.key))
                == keccak256(abi.encodePacked("outputToken")),
            _FILE,
            "Unexpected outputToken"
        );
        Require.that(
            keccak256(abi.encodePacked(_outputTokenAmount.key))
                == keccak256(abi.encodePacked("outputAmount")),
            _FILE,
            "Unexpected outputAmount"
        );
        Require.that(
            keccak256(abi.encodePacked(_secondaryOutputTokenAddress.key))
                == keccak256(abi.encodePacked("secondaryOutputToken")),
            _FILE,
            "Unexpected secondaryOutputToken"
        );
        Require.that(
            keccak256(abi.encodePacked(_secondaryOutputTokenAmount.key))
                == keccak256(abi.encodePacked("secondaryOutputAmount")),
            _FILE,
            "Unexpected secondaryOutputAmount"
        );
        Require.that(
            _outputTokenAddress.value == _secondaryOutputTokenAddress.value
                && _withdrawalInfo.outputToken == _outputTokenAddress.value,
            _FILE,
            "Can only receive one token"
        );
    }

    // ==================================================================
    // ======================== Private Functions ======================
    // ==================================================================

    function _validateWithdrawalAmountForUnwrapping(
        IGmxV2IsolationModeVaultFactory _factory,
        address _vault,
        uint256 _accountNumber,
        uint256 _withdrawalAmount,
        bool _isLiquidation
    ) private view {
        uint256 withdrawalPendingAmount = _factory.getPendingAmountByAccount(
            _vault,
            _accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Withdrawal
        );
        uint256 depositPendingAmount = _factory.getPendingAmountByAccount(
            _vault,
            _accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Deposit
        );

        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: _vault,
            number: _accountNumber
        });
        uint256 balance = _factory.DOLOMITE_MARGIN().getAccountWei(accountInfo, _factory.marketId()).value;

        if (!_isLiquidation) {
            // The requested withdrawal cannot be for more than the user's balance, minus any pending.
            Require.that(
                balance - (withdrawalPendingAmount + depositPendingAmount) >= _withdrawalAmount,
                _FILE,
                "Withdrawal too large",
                _vault,
                _accountNumber
            );
        } else {
            // The requested withdrawal must be for the entirety of the user's balance
            Require.that(
                balance - (withdrawalPendingAmount + depositPendingAmount) == _withdrawalAmount,
                _FILE,
                "Liquidation must be full balance",
                _vault,
                _accountNumber
            );
        }
    }

    function _getGmxMarketPrices(
        uint256 _indexTokenPrice,
        uint256 _longTokenPrice,
        uint256 _shortTokenPrice
    ) private pure returns (GmxMarket.MarketPrices memory) {
        // Dolomite returns price as 36 decimals - token decimals
        // GMX expects 30 decimals - token decimals so we divide by 10 ** 6
        GmxPrice.PriceProps memory indexTokenPriceProps = GmxPrice.PriceProps({
            min: _indexTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT,
            max: _indexTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT
        });
        GmxPrice.PriceProps memory longTokenPriceProps = GmxPrice.PriceProps({
            min: _longTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT,
            max: _longTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT
        });
        GmxPrice.PriceProps memory shortTokenPriceProps = GmxPrice.PriceProps({
            min: _shortTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT,
            max: _shortTokenPrice / _GMX_PRICE_SCALE_ADJUSTMENT
        });
        return GmxMarket.MarketPrices({
            indexTokenPrice: indexTokenPriceProps,
            longTokenPrice: longTokenPriceProps,
            shortTokenPrice: shortTokenPriceProps
        });
    }

    function _maxPnlFactorKey(
        bytes32 _pnlFactorType,
        address _market,
        bool _isLong
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(_MAX_PNL_FACTOR_KEY, _pnlFactorType, _market, _isLong));
    }
}
