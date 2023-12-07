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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IAsyncIsolationModeTraderBase } from "../interfaces/IAsyncIsolationModeTraderBase.sol";
import { IIsolationModeUpgradeableProxy } from "../interfaces/IIsolationModeUpgradeableProxy.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxMarket } from "../interfaces/gmx/GmxMarket.sol";
import { GmxPrice } from "../interfaces/gmx/GmxPrice.sol";
import { IGmxDataStore } from "../interfaces/gmx/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "../interfaces/gmx/IGmxV2Registry.sol";


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
    bytes32 private constant _CREATE_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("CREATE_WITHDRAWAL_FEATURE_DISABLED"));
    bytes32 private constant _EXECUTE_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("EXECUTE_WITHDRAWAL_FEATURE_DISABLED"));
    uint256 private constant _GMX_PRICE_DECIMAL_ADJUSTMENT = 6;
    uint256 private constant _GMX_PRICE_SCALE_ADJUSTMENT = 10 ** _GMX_PRICE_DECIMAL_ADJUSTMENT;

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
        _weth.safeTransferFrom(_vault, address(this), _ethExecutionFee);
        _weth.withdraw(_ethExecutionFee);

        address depositVault = _registry.gmxDepositVault();
        IERC20(_inputToken).safeApprove(address(_registry.gmxRouter()), _inputAmount);
        exchangeRouter.sendTokens{value: _ethExecutionFee}(_inputToken, depositVault, _inputAmount);

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
        uint256 _ethExecutionFee
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

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = registry.getUnwrapperByToken(_factory);
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
            /* callbackGasLimit = */ registry.callbackGasLimit()
        );

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
        address _token
    ) public view returns (bool) {
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
        bytes32 createWithdrawalKey = keccak256(abi.encode(
            _CREATE_WITHDRAWAL_FEATURE_DISABLED,
            _registry.gmxWithdrawalHandler()
        ));
        bool isCreateWithdrawalFeatureDisabled = dataStore.getBool(createWithdrawalKey);

        bytes32 executeWithdrawalKey = keccak256(abi.encode(
            _EXECUTE_WITHDRAWAL_FEATURE_DISABLED,
            _registry.gmxWithdrawalHandler()
        ));
        bool isExecuteWithdrawalFeatureDisabled = dataStore.getBool(executeWithdrawalKey);

        uint256 maxPnlForWithdrawalsShort = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, underlyingToken, /* _isLong = */ false)
        );
        uint256 maxPnlForWithdrawalsLong = dataStore.getUint(
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

        bool isShortPnlTooLarge = shortPnlToPoolFactor >= int256(maxPnlForWithdrawalsShort);
        bool isLongPnlTooLarge = longPnlToPoolFactor >= int256(maxPnlForWithdrawalsLong);

        uint256 maxCallbackGasLimit = dataStore.getUint(_MAX_CALLBACK_GAS_LIMIT_KEY);

        return isShortPnlTooLarge || isLongPnlTooLarge || _registry.callbackGasLimit() > maxCallbackGasLimit || isCreateWithdrawalFeatureDisabled || isExecuteWithdrawalFeatureDisabled; // solhint-disable-line max-line-length
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

    function _maxPnlFactorKey(
        bytes32 _pnlFactorType,
        address _market,
        bool _isLong
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(_MAX_PNL_FACTOR_KEY, _pnlFactorType, _market, _isLong));
    }
}
