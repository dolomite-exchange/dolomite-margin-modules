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
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IIsolationModeUpgradeableProxy } from "../interfaces/IIsolationModeUpgradeableProxy.sol";
import { GmxMarket } from "../interfaces/gmx/GmxMarket.sol";
import { GmxPrice } from "../interfaces/gmx/GmxPrice.sol";
import { IGmxDataStore } from "../interfaces/gmx/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";


/**
 * @title   GmxV2Library
 * @author  Dolomite
 *
 * @notice  Library contract for the GmxV2IsolationModeTokenVaultV1 contract to reduce code size
 */
library GmxV2Library {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteStructs.Par;

    // ==================================================================
    // ============================ Constants ===========================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2Library";
    bytes32 private constant _MAX_PNL_FACTOR = keccak256(abi.encode("MAX_PNL_FACTOR"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_ADL = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_ADL"));
    bytes32 private constant _MAX_PNL_FACTOR_FOR_WITHDRAWALS = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS"));
    uint256 private constant _GMX_PRICE_DECIMAL_ADJUSTMENT = 6;
    uint256 private constant _GMX_PRICE_SCALE_ADJUSTMENT = 10 ** _GMX_PRICE_DECIMAL_ADJUSTMENT;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function executeInitiateUnwrapping(
        IGmxV2IsolationModeVaultFactory _factory,
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        uint256 _ethExecutionFee
    ) public {
        IGmxRegistryV2 registry = _factory.gmxRegistryV2();
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
        unwrapper.vaultSetWithdrawalInfo(withdrawalKey, _tradeAccountNumber, _inputAmount, _outputToken);
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

    function validateExecutionFee(IGmxV2IsolationModeTokenVaultV1 _vault, uint256 _toAccountNumber) public view {
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

    function checkVaultAccountIsNotFrozen(
        IGmxV2IsolationModeVaultFactory _factory,
        address _vault,
        uint256 _accountNumber
    ) public view {
        Require.that(
            !_factory.isVaultAccountFrozen(_vault, _accountNumber),
            _FILE,
            "Account is frozen",
            _vault,
            _accountNumber
        );
    }

    function isExternalRedemptionPaused(
        IGmxRegistryV2 _registry,
        IDolomiteMargin _dolomiteMargin,
        IGmxV2IsolationModeVaultFactory _factory
    ) public view returns (bool) {
        address underlyingToken = _factory.UNDERLYING_TOKEN();
        IGmxDataStore dataStore = _registry.gmxDataStore();
        uint256 maxPnlForAdl = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_ADL, underlyingToken, /* _isLong = */ true)
        );
        uint256 maxPnlForWithdrawals = dataStore.getUint(
            _maxPnlFactorKey(_MAX_PNL_FACTOR_FOR_WITHDRAWALS, underlyingToken, /* _isLong = */ true)
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

        return isShortPnlTooLarge || isLongPnlTooLarge;
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
        return keccak256(abi.encode(
            _MAX_PNL_FACTOR,
            _pnlFactorType,
            _market,
            _isLong
        ));
    }
}
