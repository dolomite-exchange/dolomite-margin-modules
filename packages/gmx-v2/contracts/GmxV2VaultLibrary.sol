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
import { IGenericTraderBase } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderBase.sol";
import { IAsyncFreezableIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IAsyncFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1WithAsyncFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithAsyncFreezable.sol";
import { IIsolationModeUpgradeableProxy } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeUpgradeableProxy.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGmxDataStore } from "./interfaces/IGmxDataStore.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "./interfaces/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
import { GmxMarket } from "./lib/GmxMarket.sol";
import { GmxPrice } from "./lib/GmxPrice.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2VaultLibrary
 * @author  Dolomite
 *
 * @notice  Library contract for the GmxV2IsolationModeTokenVaultV1 contract to reduce code size
 */
library GmxV2VaultLibrary {
    using DecimalLib for *;
    using DolomiteMarginVersionWrapperLib for *;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;
    using TypesLib for IDolomiteStructs.Par;

    // ==================================================================
    // ============================ Constants ===========================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2VaultLibrary";
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

    function vaultValidateExecutionFeeIfWrapToUnderlying(
        IIsolationModeTokenVaultV1WithAsyncFreezable _vault,
        uint256 _tradeAccountNumber,
        IGenericTraderBase.TraderParam[] memory _tradersPath
    ) public returns (IGenericTraderBase.TraderParam[] memory) {
        uint256 len = _tradersPath.length;
        if (_tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            _validateExecutionFee(
                IAsyncFreezableIsolationModeVaultFactory(_vault.VAULT_FACTORY()),
                msg.value
            );
            _depositAndApproveWethForWrapping(_vault);
            _tradersPath[len - 1].tradeData = abi.encode(_tradeAccountNumber, abi.encode(msg.value));
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }
        return _tradersPath;
    }

    function vaultCancelDeposit(IGmxV2IsolationModeTokenVaultV1 _vault, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper = _vault.registry().getWrapperByToken(
            IGmxV2IsolationModeVaultFactory(_vault.VAULT_FACTORY())
        );
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    function vaultCancelWithdrawal(IGmxV2IsolationModeTokenVaultV1 _vault, bytes32 _key) public {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = _vault.registry().getUnwrapperByToken(
            IGmxV2IsolationModeVaultFactory(_vault.VAULT_FACTORY())
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

    function vaultInitiateUnwrapping(
        IGmxV2IsolationModeTokenVaultV1 _vault,
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData,
        uint256 _ethExecutionFee
    ) public {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(_vault.VAULT_FACTORY());
        Require.that(
            _vault.registry().getUnwrapperByToken(factory).isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );

        _validateExecutionFee(factory, msg.value);

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper = _vault.registry().getUnwrapperByToken(factory);
        IERC20(factory.UNDERLYING_TOKEN()).safeApprove(address(unwrapper), _inputAmount);
        unwrapper.vaultInitiateUnwrapping{ value: _ethExecutionFee }(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function validateExecutionFeeAndUsage(
        IIsolationModeTokenVaultV1WithAsyncFreezable _vault,
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
        IGmxV2IsolationModeVaultFactory _factory
    ) public view returns (bool) {
        address underlyingToken = _factory.UNDERLYING_TOKEN();
        IGmxDataStore dataStore = _registry.gmxDataStore();
        {
            if (dataStore.getBool(_isMarketDisableKey(underlyingToken))) {
                // If the market is disabled, return true
                return true;
            }
        }
        {
            bytes32 createWithdrawalKey = keccak256(abi.encode(
                _CREATE_WITHDRAWAL_FEATURE_DISABLED,
                _registry.gmxWithdrawalHandler()
            ));
            if (dataStore.getBool(createWithdrawalKey)) {
                // If withdrawal creation is disabled, return true
                return true;
            }
        }

        {
            bytes32 executeWithdrawalKey = keccak256(abi.encode(
                _EXECUTE_WITHDRAWAL_FEATURE_DISABLED,
                _registry.gmxWithdrawalHandler()
            ));
            if (dataStore.getBool(executeWithdrawalKey)) {
                // If withdrawal execution is disabled, return true
                return true;
            }
        }

        IDolomitePriceOracle aggregator = _registry.dolomiteRegistry().oracleAggregator();
        GmxMarket.MarketPrices memory marketPrices = _getGmxMarketPrices(
            aggregator.getPrice(_registry.gmxMarketToIndexToken(underlyingToken)).value,
            aggregator.getPrice(_factory.LONG_TOKEN()).value,
            aggregator.getPrice(_factory.SHORT_TOKEN()).value
        );

        {
            bool isShortPnlTooLarge = _isPnlToPoolFactorTooLarge(
                _registry,
                dataStore,
                underlyingToken,
                marketPrices,
                /* _isLong = */ false
            );
            if (isShortPnlTooLarge) {
                return true;
            }
        }

        {
            bool isLongPnlTooLarge = _isPnlToPoolFactorTooLarge(
                _registry,
                dataStore,
                underlyingToken,
                marketPrices,
                /* _isLong = */ true
            );
            if (isLongPnlTooLarge) {
                return true;
            }
        }

        uint256 maxCallbackGasLimit = dataStore.getUint(_MAX_CALLBACK_GAS_LIMIT_KEY);
        return _registry.callbackGasLimit() > maxCallbackGasLimit;
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

    function validateInitialMarketIds(
        uint256[] memory _marketIds,
        uint256 _longMarketId,
        uint256 _shortMarketId
    ) public pure {
        if (_longMarketId == type(uint256).max) {
            Require.that(
                _marketIds.length >= 1,
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

    // ==================================================================
    // ======================== Private Functions ======================
    // ==================================================================

    function _depositAndApproveWethForWrapping(IIsolationModeTokenVaultV1WithAsyncFreezable _vault) private {
        Require.that(
            msg.value > 0,
            _FILE,
            "Invalid execution fee"
        );
        _vault.WETH().deposit{value: msg.value}();
        IERC20(address(_vault.WETH())).safeApprove(
            address(_vault.handlerRegistry().getWrapperByToken(IIsolationModeVaultFactory(_vault.VAULT_FACTORY()))),
            msg.value
        );
    }

    function _validateExecutionFee(
        IAsyncFreezableIsolationModeVaultFactory _factory,
        uint256 _msgValue
    ) private view {
        Require.that(
            _msgValue <= _factory.maxExecutionFee(),
            _FILE,
            "Invalid execution fee"
        );
    }

    function _isPnlToPoolFactorTooLarge(
        IGmxV2Registry _registry,
        IGmxDataStore _dataStore,
        address _underlyingToken,
        GmxMarket.MarketPrices memory _marketPrices,
        bool _isLong
    ) private view returns (bool) {
        int256 pnlToPoolFactor = _registry.gmxReader().getPnlToPoolFactor(
            _dataStore,
            _underlyingToken,
            _marketPrices,
            _isLong,
            /* _maximize = */ true
        );
        uint256 maxPnlForWithdrawalsValue = _dataStore.getUint(_maxPnlFactorKey(_underlyingToken, _isLong));
        return pnlToPoolFactor > int256(maxPnlForWithdrawalsValue);
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

    function _validateVaultOwnerForStruct(address _vault) private view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
        );
    }

    function _maxPnlFactorKey(
        address _market,
        bool _isLong
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(_MAX_PNL_FACTOR_KEY, _MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY, _market, _isLong)
        );
    }

    function _isMarketDisableKey(address _market) private pure returns (bytes32) {
        return keccak256(abi.encode(_IS_MARKET_DISABLED, _market));
    }

    function _validateEventData(string memory _foundKey, string memory _expectedKey) private pure {
        Require.that(
            keccak256(abi.encodePacked(_foundKey)) == keccak256(abi.encodePacked(_expectedKey)),
            _FILE,
            bytes32(abi.encodePacked("Unexpected ", _expectedKey))
        );
    }
}
