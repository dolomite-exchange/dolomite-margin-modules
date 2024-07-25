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
import { IAsyncIsolationModeTraderBase } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IAsyncIsolationModeTraderBase.sol";
import { IIsolationModeUpgradeableProxy } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeUpgradeableProxy.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { DolomiteMarginVersionWrapperLib } from "@dolomite-exchange/modules-base/contracts/lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGmxDataStore } from "./interfaces/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "./interfaces/IGmxExchangeRouter.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "./interfaces/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "./interfaces/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
import { GmxEventUtils } from "./lib/GmxEventUtils.sol";
import { GmxMarket } from "./lib/GmxMarket.sol";
import { GmxPrice } from "./lib/GmxPrice.sol";
// solhint-enable max-line-length

import "hardhat/console.sol";


/**
 * @title   GmxV2Library
 * @author  Dolomite
 *
 * @notice  Library contract for the GmxV2IsolationModeTokenVaultV1 contract to reduce code size
 */
library GmxV2Library {
    using DecimalLib for *;
    using DolomiteMarginVersionWrapperLib for *;
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
    bytes32 private constant _CREATE_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("CREATE_WITHDRAWAL_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _EXECUTE_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("EXECUTE_WITHDRAWAL_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _EXECUTE_DEPOSIT_FEATURE_DISABLED = keccak256(abi.encode("EXECUTE_DEPOSIT_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _IS_MARKET_DISABLED = keccak256(abi.encode("IS_MARKET_DISABLED"));
    uint256 private constant _GMX_PRICE_DECIMAL_ADJUSTMENT = 6;
    uint256 private constant _GMX_PRICE_SCALE_ADJUSTMENT = 10 ** _GMX_PRICE_DECIMAL_ADJUSTMENT;

    // =========================================================
    // ======================== Structs ========================
    // =========================================================

    struct MiniCache {
        IDolomiteMargin dolomiteMargin;
        uint256 inputMarketId;
        uint256 outputMarketId;
        uint256 longMarketId;
        uint256 shortMarketId;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function createDeposit(
        IGmxV2IsolationModeVaultFactory _factory,
        IGmxV2Registry _registry,
        IWETH _weth,
        address _vault,
        uint256 _ethExecutionFee,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount
    ) public returns (bytes32) {
        IGmxExchangeRouter exchangeRouter = _registry.gmxExchangeRouter();
        bytes32 executeDepositKey = keccak256(abi.encode(
            _EXECUTE_DEPOSIT_FEATURE_DISABLED,
            exchangeRouter.depositHandler()
        ));
        Require.that(
            !_registry.gmxDataStore().getBool(executeDepositKey),
            _FILE,
            "Execute deposit feature disabled"
        );

        address depositVault = _registry.gmxDepositVault();
        if (_inputToken == address(_weth)) {
            _weth.safeTransferFrom(_vault, address(this), _ethExecutionFee);
            _weth.safeApprove(address(_registry.gmxRouter()), _ethExecutionFee + _inputAmount);
            exchangeRouter.sendTokens(address(_weth), depositVault, _ethExecutionFee + _inputAmount);
        } else {
            _weth.safeTransferFrom(_vault, address(this), _ethExecutionFee);
            _weth.safeApprove(address(_registry.gmxRouter()), _ethExecutionFee);
            exchangeRouter.sendTokens(address(_weth), depositVault, _ethExecutionFee);

            IERC20(_inputToken).safeApprove(address(_registry.gmxRouter()), _inputAmount);
            exchangeRouter.sendTokens(_inputToken, depositVault, _inputAmount);
        }

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

    function initiateCancelWithdrawal(IGmxV2IsolationModeUnwrapperTraderV2 _unwrapper, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo =
                            _unwrapper.getWithdrawalInfo(_key);
        Require.that(
            msg.sender == withdrawalInfo.vault
                || IAsyncIsolationModeTraderBase(address(_unwrapper)).isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        _unwrapper.GMX_REGISTRY_V2().gmxExchangeRouter().cancelWithdrawal(_key);
    }

    function executeInitiateUnwrapping(
        IGmxV2IsolationModeVaultFactory _factory,
        address _vault,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        uint256 _ethExecutionFee,
        bytes calldata _extraData
    ) public returns (bytes32) {
        IERC20(_factory.UNDERLYING_TOKEN()).safeTransferFrom(_vault, address(this), _inputAmount);

        IGmxV2Registry registry = _factory.gmxV2Registry();
        IGmxExchangeRouter exchangeRouter = registry.gmxExchangeRouter();

        address[] memory swapPath = new address[](1);
        swapPath[0] = _factory.UNDERLYING_TOKEN();

        // Change scope for stack too deep
        {
            address withdrawalVault = registry.gmxWithdrawalVault();
            exchangeRouter.sendWnt{value: _ethExecutionFee}(withdrawalVault, _ethExecutionFee);
            IERC20(swapPath[0]).safeApprove(address(registry.gmxRouter()), _inputAmount);
            exchangeRouter.sendTokens(swapPath[0], withdrawalVault, _inputAmount);
        }

        Require.that(
            _extraData.length == 64,
            _FILE,
            "Invalid extra data"
        );

        // Fix stack too deep
        address outputToken = _outputToken;
        IGmxV2IsolationModeVaultFactory factory = _factory;
        address longToken = factory.LONG_TOKEN();

        (, uint256 minOtherTokenAmount) = abi.decode(_extraData, (IDolomiteStructs.Decimal, uint256));
        _minOutputAmount -= minOtherTokenAmount; // subtract from the total figure to get its value from the Zap SDK
        Require.that(
            _minOutputAmount > 0 && minOtherTokenAmount > 0,
            _FILE,
            "minOutputAmount too small"
        );
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = registry.getUnwrapperByToken(factory);
        IGmxExchangeRouter.CreateWithdrawalParams memory withdrawalParams = IGmxExchangeRouter.CreateWithdrawalParams(
            /* receiver = */ address(unwrapper),
            /* callbackContract = */ address(unwrapper),
            /* uiFeeReceiver = */ address(0),
            /* market = */ swapPath[0],
            /* longTokenSwapPath = */ outputToken == longToken ? new address[](0) : swapPath,
            /* shortTokenSwapPath = */ outputToken != longToken ? new address[](0) : swapPath,
            /* minLongTokenAmount = */ longToken == outputToken ? _minOutputAmount : minOtherTokenAmount,
            /* minShortTokenAmount = */ longToken != outputToken ? _minOutputAmount : minOtherTokenAmount,
            /* shouldUnwrapNativeToken = */ false,
            /* executionFee = */ _ethExecutionFee,
            /* callbackGasLimit = */ registry.callbackGasLimit()
        );

        if (longToken == factory.SHORT_TOKEN()) {
            withdrawalParams.longTokenSwapPath = new address[](0);
            withdrawalParams.shortTokenSwapPath = new address[](0);
        }
        return exchangeRouter.createWithdrawal(withdrawalParams);
    }

    function depositAndApproveWethForWrapping(IGmxV2IsolationModeTokenVaultV1 _vault) public {
        Require.that(
            msg.value > 0,
            _FILE,
            "Invalid execution fee"
        );
        _vault.WETH().deposit{value: msg.value}();
        IERC20(address(_vault.WETH())).safeApprove(
            address(_vault.registry().getWrapperByToken(IIsolationModeVaultFactory(_vault.VAULT_FACTORY()))),
            msg.value
        );
    }

    function isValidInputOrOutputToken(
        IGmxV2IsolationModeVaultFactory _factory,
        address _token,
        bool _checkLongToken
    ) public view returns (bool) {
        if (!_checkLongToken) {
            return _token == _factory.SHORT_TOKEN();
        }
        return _token == _factory.LONG_TOKEN() || _token == _factory.SHORT_TOKEN();
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
        {
            bool isMarketDisabled = dataStore.getBool(_isMarketDisableKey(underlyingToken));
            if (isMarketDisabled) {
                return true;
            }
        }
        {
            bytes32 createWithdrawalKey = keccak256(abi.encode(
                _CREATE_WITHDRAWAL_FEATURE_DISABLED,
                _registry.gmxWithdrawalHandler()
            ));
            bool isCreateWithdrawalFeatureDisabled = dataStore.getBool(createWithdrawalKey);
            if (isCreateWithdrawalFeatureDisabled) {
                return true;
            }
        }

        {
            bytes32 executeWithdrawalKey = keccak256(abi.encode(
                _EXECUTE_WITHDRAWAL_FEATURE_DISABLED,
                _registry.gmxWithdrawalHandler()
            ));
            bool isExecuteWithdrawalFeatureDisabled = dataStore.getBool(executeWithdrawalKey);
            if (isExecuteWithdrawalFeatureDisabled) {
                return true;
            }
        }

        console.log('here middle of pause');
        uint256 maxPnlForWithdrawalsShort = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, underlyingToken, /* _isLong = */ false)
        );
        uint256 maxPnlForWithdrawalsLong = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, underlyingToken, /* _isLong = */ true)
        );

        IDolomitePriceOracle aggregator = _registry.dolomiteRegistry().oracleAggregator();
        GmxMarket.MarketPrices memory marketPrices = _getGmxMarketPrices(
            aggregator.getPrice(
                _registry.gmxMarketToIndexToken(underlyingToken)
            ).value,
            aggregator.getPrice(_factory.LONG_TOKEN()).value,
            aggregator.getPrice(_factory.SHORT_TOKEN()).value
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

        console.logInt(shortPnlToPoolFactor);
        console.log('maxPnlForWithdrawalsShort: ', maxPnlForWithdrawalsShort);

        bool isShortPnlTooLarge = shortPnlToPoolFactor > int256(maxPnlForWithdrawalsShort);
        bool isLongPnlTooLarge = longPnlToPoolFactor > int256(maxPnlForWithdrawalsLong);

        uint256 maxCallbackGasLimit = dataStore.getUint(_MAX_CALLBACK_GAS_LIMIT_KEY);
        {
        console.log('isShortPnlTooLarge: ', isShortPnlTooLarge);
        console.log('isLongPnlTooLarge: ', isLongPnlTooLarge);
        // console.log('maxCallbackGasLimit: ', maxCallbackGasLimit);
        // console.log('callbackGasLimit: ', _registry.callbackGasLimit());
        }

        return isShortPnlTooLarge || isLongPnlTooLarge || _registry.callbackGasLimit() > maxCallbackGasLimit;
    }

    function validateInitialMarketIds(
        uint256[] memory _marketIds,
        uint256 _longMarketId,
        uint256 _shortMarketId
    ) public pure {
        if (_longMarketId == type(uint256).max) {
            Require.that(
                _marketIds.length == 1,
                _FILE,
                "Invalid market IDs length"
            );
            Require.that(
                _marketIds[0] == _shortMarketId,
                _FILE,
                "Invalid market IDs"
            );
        } else {
            Require.that(
                _marketIds.length >= 2,
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
    }

    function validateEventDataForWithdrawal(
        IGmxV2IsolationModeVaultFactory _factory,
        GmxEventUtils.AddressKeyValue memory _outputTokenAddress,
        GmxEventUtils.UintKeyValue memory _outputTokenAmount,
        GmxEventUtils.AddressKeyValue memory _secondaryOutputTokenAddress,
        GmxEventUtils.UintKeyValue memory _secondaryOutputTokenAmount,
        IGmxV2IsolationModeUnwrapperTraderV2.WithdrawalInfo memory _withdrawalInfo
    ) public view {
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

        if (_withdrawalInfo.outputToken == _factory.LONG_TOKEN()) {
            Require.that(
                _withdrawalInfo.outputToken == _outputTokenAddress.value,
                _FILE,
                "Output token is incorrect"
            );

            if (_secondaryOutputTokenAmount.value > 0) {
                Require.that(
                    _outputTokenAddress.value == _secondaryOutputTokenAddress.value,
                    _FILE,
                    "Can only receive one token"
                );
            }
        } else {
            Require.that(
                _withdrawalInfo.outputToken == _secondaryOutputTokenAddress.value,
                _FILE,
                "Output token is incorrect"
            );

            if (_outputTokenAmount.value > 0) {
                Require.that(
                    _outputTokenAddress.value == _secondaryOutputTokenAddress.value,
                    _FILE,
                    "Can only receive one token"
                );
            }
        }
    }

    function validateMinAmountIsNotTooLargeForLiquidation(
        IGmxV2IsolationModeVaultFactory _factory,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bytes calldata _extraData,
        uint256 _chainId
    ) public view {
        // For managing "stack too deep"
        MiniCache memory cache = MiniCache({
            dolomiteMargin: _factory.DOLOMITE_MARGIN(),
            inputMarketId: _factory.marketId(),
            outputMarketId: _factory.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken),
            longMarketId: _factory.LONG_TOKEN_MARKET_ID(),
            shortMarketId: _factory.SHORT_TOKEN_MARKET_ID()
        });
        (IDolomiteStructs.Decimal memory weight, uint256 otherMinOutputAmount) = abi.decode(
            _extraData,
            (IDolomiteStructs.Decimal, uint256)
        );
        _minOutputAmount -= otherMinOutputAmount;

        _requireMinAmountIsNotTooLargeForLiquidation(
            cache.dolomiteMargin,
            _liquidAccount,
            cache.inputMarketId,
            cache.outputMarketId,
            _inputAmount.mul(DecimalLib.oneSub(weight)),
            _minOutputAmount,
            _chainId
        );

        // Check the min output amount of the other token too since GM is unwound via 2 tokens. The
        // `otherMinOutputAmount` is the min amount out we'll accept when swapping to `outputToken`
        _requireMinAmountIsNotTooLargeForLiquidation(
            cache.dolomiteMargin,
            _liquidAccount,
            cache.inputMarketId,
            cache.outputMarketId,
            _inputAmount.mul(weight),
            otherMinOutputAmount,
            _chainId
        );
    }

    // ==================================================================
    // ======================== Private Functions ======================
    // ==================================================================

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

    function _requireMinAmountIsNotTooLargeForLiquidation(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputTokenAmount,
        uint256 _minOutputAmount,
        uint256 _chainId
    ) private view {
        uint256 inputValue = _dolomiteMargin.getMarketPrice(_inputMarketId).value * _inputTokenAmount;
        uint256 outputValue = _dolomiteMargin.getMarketPrice(_outputMarketId).value * _minOutputAmount;

        IDolomiteMargin.Decimal memory spread = _dolomiteMargin.getVersionedLiquidationSpreadForPair(
            _chainId,
            _liquidAccount,
            /* heldMarketId = */ _inputMarketId,
            /* ownedMarketId = */ _outputMarketId
        );
        spread.value /= 2;
        uint256 inputValueAdj = inputValue - inputValue.mul(spread);

        Require.that(
            outputValue <= inputValueAdj,
            _FILE,
            "minOutputAmount too large"
        );
    }

    function _maxPnlFactorKey(
        bytes32 _pnlFactorType,
        address _market,
        bool _isLong
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(_MAX_PNL_FACTOR_KEY, _pnlFactorType, _market, _isLong));
    }

    function _isMarketDisableKey(address _market) private pure returns (bytes32) {
        return keccak256(abi.encode(_IS_MARKET_DISABLED, _market));
    }
}
