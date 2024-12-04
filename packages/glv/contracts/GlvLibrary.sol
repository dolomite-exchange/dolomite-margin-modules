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
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { DolomiteMarginVersionWrapperLib } from "@dolomite-exchange/modules-base/contracts/lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";
import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";
import { GmxMarket } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxMarket.sol";
import { GmxPrice } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxPrice.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGlvIsolationModeTokenVaultV1 } from "./interfaces/IGlvIsolationModeTokenVaultV1.sol";
import { IGlvIsolationModeUnwrapperTraderV2 } from "./interfaces/IGlvIsolationModeUnwrapperTraderV2.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvIsolationModeWrapperTraderV2 } from "./interfaces/IGlvIsolationModeWrapperTraderV2.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
import { IGlvRouter } from "./interfaces/IGlvRouter.sol";
import { GlvDepositUtils } from "./lib/GlvDepositUtils.sol";
import { GlvWithdrawalUtils } from "./lib/GlvWithdrawalUtils.sol";
// solhint-enable max-line-length


/**
 * @title   GlvLibrary
 * @author  Dolomite
 *
 * @notice  Library contract for the GlvIsolationModeTokenVaultV1 contract to reduce code size
 */
library GlvLibrary {
    using DecimalLib for *;
    using DolomiteMarginVersionWrapperLib for *;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;
    using TypesLib for IDolomiteStructs.Par;

    // ==================================================================
    // ============================ Constants ===========================
    // ==================================================================

    bytes32 private constant _FILE = "GlvLibrary";
    bytes32 private constant _MAX_PNL_FACTOR_KEY = keccak256(abi.encode("MAX_PNL_FACTOR"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_ADL_KEY = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_ADL"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS")); // solhint-disable-line max-line-length
    bytes32 private constant _MAX_CALLBACK_GAS_LIMIT_KEY = keccak256(abi.encode("MAX_CALLBACK_GAS_LIMIT"));
    bytes32 private constant _CREATE_GLV_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("CREATE_GLV_WITHDRAWAL_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _EXECUTE_GLV_WITHDRAWAL_FEATURE_DISABLED = keccak256(abi.encode("EXECUTE_GLV_WITHDRAWAL_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED = keccak256(abi.encode("EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED")); // solhint-disable-line max-line-length
    bytes32 private constant _IS_MARKET_DISABLED = keccak256(abi.encode("IS_MARKET_DISABLED"));
    bytes32 private constant _IS_GLV_MARKET_DISABLED = keccak256(abi.encode("IS_GLV_MARKET_DISABLED"));
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

    function wrapperCreateDeposit(
        IGlvIsolationModeVaultFactory _factory,
        IGlvRegistry _registry,
        IWETH _weth,
        address _vault,
        uint256 _ethExecutionFee,
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount
    ) public returns (bytes32) {
        bytes32 executeDepositKey = keccak256(abi.encode(
            _EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED,
            _registry.glvHandler()
        ));
        Require.that(
            !_registry.gmxDataStore().getBool(executeDepositKey),
            _FILE,
            "Execute deposit feature disabled"
        );

        IGlvRouter glvRouter = _registry.glvRouter();
        address vault = _registry.glvVault();
        if (_inputToken == address(_weth)) {
            _weth.safeTransferFrom(_vault, address(this), _ethExecutionFee);
            _weth.safeApprove(glvRouter.router(), _ethExecutionFee + _inputAmount);
            glvRouter.sendTokens(address(_weth), vault, _ethExecutionFee + _inputAmount);
        } else {
            _weth.safeTransferFrom(_vault, address(this), _ethExecutionFee);
            _weth.safeApprove(glvRouter.router(), _ethExecutionFee);
            glvRouter.sendTokens(address(_weth), vault, _ethExecutionFee);

            IERC20(_inputToken).safeApprove(glvRouter.router(), _inputAmount);
            glvRouter.sendTokens(_inputToken, vault, _inputAmount);
        }
        IGlvIsolationModeVaultFactory factory = _factory;
        GlvDepositUtils.CreateGlvDepositParams memory depositParams = GlvDepositUtils.CreateGlvDepositParams(
            /* glv = */ _outputTokenUnderlying,
            /* market = */ _registry.glvTokenToGmMarket(factory.UNDERLYING_TOKEN()),
            /* receiver = */ address(this),
            /* callbackContract = */ address(this),
            /* uiFeeReceiver = */ address(0),
            /* initialLongToken = */ factory.LONG_TOKEN(),
            /* initialShortToken = */ factory.SHORT_TOKEN(),
            /* longTokenSwapPath = */ new address[](0),
            /* shortTokenSwapPath = */ new address[](0),
            /* minGlvTokens = */ _minOutputAmount,
            /* executionFee = */ _ethExecutionFee,
            /* callbackGasLimit = */ _registry.callbackGasLimit(),
            /* shouldUnwrapNativeToken = */ false,
            /* isMarketTokenDeposit = */ false
        );

        return glvRouter.createGlvDeposit(depositParams);
    }

    function initiateCancelDeposit(IGlvIsolationModeWrapperTraderV2 _wrapper, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory depositInfo = _wrapper.getDepositInfo(_key);
        Require.that(
            msg.sender == depositInfo.vault
                || IAsyncIsolationModeTraderBase(address(_wrapper)).isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        _wrapper.GLV_REGISTRY().glvRouter().cancelGlvDeposit(_key);
    }

    function unwrapperInitiateCancelWithdrawal(IGlvIsolationModeUnwrapperTraderV2 _unwrapper, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo =
                            _unwrapper.getWithdrawalInfo(_key);
        Require.that(
            msg.sender == withdrawalInfo.vault
                || IAsyncIsolationModeTraderBase(address(_unwrapper)).isHandler(msg.sender),
            _FILE,
            "Only vault or handler can cancel"
        );
        _unwrapper.GLV_REGISTRY().glvRouter().cancelGlvWithdrawal(_key);
    }

    function unwrapperExecuteInitiateUnwrapping(
        IGlvIsolationModeVaultFactory _factory,
        address _vault,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        uint256 _ethExecutionFee,
        bytes calldata _extraData
    ) public returns (bytes32) {
        IERC20(_factory.UNDERLYING_TOKEN()).safeTransferFrom(_vault, address(this), _inputAmount);

        IGlvRegistry registry = _factory.glvRegistry();
        IGlvRouter glvRouter = registry.glvRouter();

        address[] memory swapPath = new address[](1);
        swapPath[0] = registry.glvTokenToGmMarket(_factory.UNDERLYING_TOKEN());

        // Change scope for stack too deep
        {
            address vault = registry.glvVault();
            glvRouter.sendWnt{value: _ethExecutionFee}(vault, _ethExecutionFee);
            IERC20(_factory.UNDERLYING_TOKEN()).safeApprove(glvRouter.router(), _inputAmount);
            glvRouter.sendTokens(_factory.UNDERLYING_TOKEN(), vault, _inputAmount);
        }

        Require.that(
            _extraData.length == 64,
            _FILE,
            "Invalid extra data"
        );

        // Fix stack too deep
        address outputToken = _outputToken;
        IGlvIsolationModeVaultFactory factory = _factory;
        address longToken = factory.LONG_TOKEN();

        (, uint256 minOtherTokenAmount) = abi.decode(_extraData, (IDolomiteStructs.Decimal, uint256));
        _minOutputAmount -= minOtherTokenAmount; // subtract from the total figure to get its value from the Zap SDK
        Require.that(
            _minOutputAmount > 0 && minOtherTokenAmount > 0,
            _FILE,
            "minOutputAmount too small"
        );
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = registry.getUnwrapperByToken(factory);
        GlvWithdrawalUtils.CreateGlvWithdrawalParams memory withdrawalParams =
            GlvWithdrawalUtils.CreateGlvWithdrawalParams(
                /* receiver = */ address(unwrapper),
                /* callbackContract = */ address(unwrapper),
                /* uiFeeReceiver = */ address(0),
                /* market = */ swapPath[0],
                /* glv = */ factory.UNDERLYING_TOKEN(),
                /* longTokenSwapPath = */ outputToken == longToken ? new address[](0) : swapPath,
                /* shortTokenSwapPath = */ outputToken != longToken ? new address[](0) : swapPath,
                /* minLongTokenAmount = */ longToken == outputToken ? _minOutputAmount : minOtherTokenAmount,
                /* minShortTokenAmount = */ longToken != outputToken ? _minOutputAmount : minOtherTokenAmount,
                /* shouldUnwrapNativeToken = */ false,
                /* executionFee = */ _ethExecutionFee,
                /* callbackGasLimit = */ registry.callbackGasLimit()
            );

        return glvRouter.createGlvWithdrawal(withdrawalParams);
    }

    function vaultCancelDeposit(IGlvIsolationModeTokenVaultV1 _vault, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper = _vault.registry().getWrapperByToken(
            IGlvIsolationModeVaultFactory(_vault.VAULT_FACTORY())
        );
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    function vaultCancelWithdrawal(IGlvIsolationModeTokenVaultV1 _vault, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = _vault.registry().getUnwrapperByToken(
            IGlvIsolationModeVaultFactory(_vault.VAULT_FACTORY())
        );
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo
            = unwrapper.getWithdrawalInfo(_key);
        _validateVaultOwnerForStruct(withdrawalInfo.vault);
        Require.that(
            !withdrawalInfo.isLiquidation,
            _FILE,
            "Withdrawal from liquidation"
        );
        unwrapper.initiateCancelWithdrawal(_key);
    }

    function isExternalRedemptionPaused(
        IGlvRegistry _registry,
        IGlvIsolationModeVaultFactory _factory
    ) public view returns (bool) {
        address glvToken = _factory.UNDERLYING_TOKEN();
        IGmxDataStore dataStore = _registry.gmxDataStore();
        address gmMarket = _registry.glvTokenToGmMarket(glvToken);
        {
            bool isGlvMarketDisabled = dataStore.getBool(_isGlvMarketDisableKey(glvToken));
            if (isGlvMarketDisabled) {
                return true;
            }
        }
        {
            bool isMarketDisabled = dataStore.getBool(_isMarketDisableKey(gmMarket));
            if (isMarketDisabled) {
                return true;
            }
        }
        {
            bytes32 createWithdrawalKey = keccak256(abi.encode(
                _CREATE_GLV_WITHDRAWAL_FEATURE_DISABLED,
                _registry.glvHandler()
            ));
            bool isCreateWithdrawalFeatureDisabled = dataStore.getBool(createWithdrawalKey);
            if (isCreateWithdrawalFeatureDisabled) {
                return true;
            }
        }

        {
            bytes32 executeWithdrawalKey = keccak256(abi.encode(
                _EXECUTE_GLV_WITHDRAWAL_FEATURE_DISABLED,
                _registry.glvHandler()
            ));
            bool isExecuteWithdrawalFeatureDisabled = dataStore.getBool(executeWithdrawalKey);
            if (isExecuteWithdrawalFeatureDisabled) {
                return true;
            }
        }

        uint256 maxPnlForWithdrawalsShort = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, gmMarket, /* _isLong = */ false)
        );
        uint256 maxPnlForWithdrawalsLong = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, gmMarket, /* _isLong = */ true)
        );

        IDolomitePriceOracle aggregator = _registry.dolomiteRegistry().oracleAggregator();
        GmxMarket.MarketProps memory props = _registry.gmxReader().getMarket(dataStore, gmMarket);
        GmxMarket.MarketPrices memory marketPrices = _getGmxMarketPrices(
            aggregator.getPrice(props.indexToken).value,
            aggregator.getPrice(props.longToken).value,
            aggregator.getPrice(props.shortToken).value
        );

        int256 shortPnlToPoolFactor = _registry.gmxReader().getPnlToPoolFactor(
            dataStore,
            gmMarket,
            marketPrices,
            /* _isLong = */ false,
            /* _maximize = */ true
        );
        int256 longPnlToPoolFactor = _registry.gmxReader().getPnlToPoolFactor(
            dataStore,
            gmMarket,
            marketPrices,
            /* _isLong = */ true,
            /* _maximize = */ true
        );

        bool isShortPnlTooLarge = shortPnlToPoolFactor > int256(maxPnlForWithdrawalsShort);
        bool isLongPnlTooLarge = longPnlToPoolFactor > int256(maxPnlForWithdrawalsLong);

        return isShortPnlTooLarge
            || isLongPnlTooLarge
            || _registry.callbackGasLimit() > dataStore.getUint(_MAX_CALLBACK_GAS_LIMIT_KEY);
    }

    function validateEventDataForWithdrawal(
        IGlvIsolationModeVaultFactory _factory,
        uint256 _marketTokenAmount,
        GmxEventUtils.AddressKeyValue memory _outputTokenAddress,
        GmxEventUtils.UintKeyValue memory _outputTokenAmount,
        GmxEventUtils.AddressKeyValue memory _secondaryOutputTokenAddress,
        GmxEventUtils.UintKeyValue memory _secondaryOutputTokenAmount,
        IGlvIsolationModeUnwrapperTraderV2.WithdrawalInfo memory _withdrawalInfo
    ) public view {
        Require.that(
            _marketTokenAmount >= _withdrawalInfo.inputAmount,
            _FILE,
            "Invalid market token amount"
        );

        _validateEventData(_outputTokenAddress.key, "outputToken");
        _validateEventData(_outputTokenAmount.key, "outputAmount");
        _validateEventData(_secondaryOutputTokenAddress.key, "secondaryOutputToken");
        _validateEventData(_secondaryOutputTokenAmount.key, "secondaryOutputAmount");

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

    function _validateVaultOwnerForStruct(address _vault) private view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
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

    function _isGlvMarketDisableKey(address _market) private pure returns (bytes32) {
        return keccak256(abi.encode(_IS_GLV_MARKET_DISABLED, _market));
    }

    function _validateEventData(string memory _foundKey, string memory _expectedKey) private pure {
        Require.that(
            keccak256(abi.encodePacked(_foundKey)) == keccak256(abi.encodePacked(_expectedKey)),
            _FILE,
            bytes32(abi.encodePacked("Unexpected ", _expectedKey))
        );
    }
}
