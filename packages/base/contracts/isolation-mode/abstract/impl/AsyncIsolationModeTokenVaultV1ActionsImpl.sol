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

import { IDolomiteRegistry } from "../../../interfaces/IDolomiteRegistry.sol";
import { DolomiteMarginVersionWrapperLib } from "../../../lib/DolomiteMarginVersionWrapperLib.sol";
import { InterestIndexLib } from "../../../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { BitsLib } from "../../../protocol/lib/BitsLib.sol";
import { DecimalLib } from "../../../protocol/lib/DecimalLib.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { BaseLiquidatorProxy } from "../../../proxies/BaseLiquidatorProxy.sol";
import { IAsyncFreezableIsolationModeVaultFactory } from "../../interfaces/IAsyncFreezableIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";


/**
 * @title   AsyncIsolationModeTokenVaultV1ActionsImpl
 * @author  Dolomite
 *
 * Reusable library for functions that save bytecode on the async isolation mode token vault contracts
 */
library AsyncIsolationModeTokenVaultV1ActionsImpl {
    using DecimalLib for uint256;
    using DolomiteMarginVersionWrapperLib for IDolomiteMargin;
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "AsyncIsolationModeVaultV1Impl";

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function validateWithdrawalAmountForUnwrapping(
        IAsyncFreezableIsolationModeVaultFactory _factory,
        uint256 _accountNumber,
        uint256 _withdrawalAmount,
        bool _isLiquidation
    ) public view {
        Require.that(
            _withdrawalAmount > 0,
            _FILE,
            "Invalid withdrawal amount"
        );

        address vault = address(this);
        uint256 withdrawalPendingAmount = _factory.getPendingAmountByAccount(
            vault,
            _accountNumber,
            IAsyncFreezableIsolationModeVaultFactory.FreezeType.Withdrawal
        );
        uint256 depositPendingAmount = _factory.getPendingAmountByAccount(
            vault,
            _accountNumber,
            IAsyncFreezableIsolationModeVaultFactory.FreezeType.Deposit
        );

        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: vault,
            number: _accountNumber
        });
        uint256 balance = _factory.DOLOMITE_MARGIN().getAccountWei(accountInfo, _factory.marketId()).value;

        if (!_isLiquidation) {
            // The requested withdrawal cannot be for more than the user's balance, minus any pending.
            Require.that(
                balance - (withdrawalPendingAmount + depositPendingAmount) >= _withdrawalAmount,
                _FILE,
                "Withdrawal too large",
                vault,
                _accountNumber
            );
        } else {
            // The requested withdrawal must be for the entirety of the user's balance
            Require.that(
                balance - (withdrawalPendingAmount + depositPendingAmount) > 0,
                _FILE,
                "Account is frozen",
                vault,
                _accountNumber
            );
            Require.that(
                balance - (withdrawalPendingAmount + depositPendingAmount) == _withdrawalAmount,
                _FILE,
                "Liquidation must be full balance",
                vault,
                _accountNumber
            );
        }
    }

    function validateMinAmountOutForLiquidation(
        IDolomiteMargin _dolomiteMargin,
        uint256 _chainId,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputTokenAmount,
        uint256 _minOutputAmount
    ) public view {
        uint256 inputValue = _dolomiteMargin.getMarketPrice(_inputMarketId).value * _inputTokenAmount;
        uint256 outputValue = _dolomiteMargin.getMarketPrice(_outputMarketId).value * _minOutputAmount;

        IDolomiteStructs.Decimal memory spread = _dolomiteMargin.getVersionedLiquidationSpreadForPair(
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

    function validateMinAmountOutForWrapToUnderlying(
        IDolomiteRegistry _dolomiteRegistry,
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputAmount,
        uint256 _minOutputAmount
    ) public view {
        if (_inputAmount == type(uint256).max) {
            IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            });
            _inputAmount = _dolomiteMargin.getAccountWei(account, _inputMarketId).value;
        }

        uint256 inputValue = _dolomiteMargin.getMarketPrice(_inputMarketId).value * _inputAmount;
        uint256 outputValue = _dolomiteMargin.getMarketPrice(_outputMarketId).value * _minOutputAmount;

        IDolomiteStructs.Decimal memory toleranceDecimal = IDolomiteStructs.Decimal({
            value: _dolomiteRegistry.slippageToleranceForPauseSentinel()
        });
        uint256 inputValueAdj = inputValue + inputValue.mul(toleranceDecimal);

        Require.that(
            outputValue <= inputValueAdj,
            _FILE,
            "minOutputAmount too large"
        );
    }

    function getFunctionSelector(bytes memory _call) public pure returns (bytes4 result) {
        Require.that(
            _call.length >= 4,
            _FILE,
            "Invalid calldata length"
        );

        // The bytes4 keyword casts a byte array (in memory) to a fixed-size byte array
        assembly {
            // load the 2nd word from original (1st word is length) and store it in the result
            result := mload(add(_call, 32))
        }
    }

    function selectorBinarySearch(bytes4[] memory _allowedSelectors, bytes4 _selector) public pure returns (bool) {
        if (_allowedSelectors.length == 0) {
            return false;
        }

        uint256 low = 0;
        uint256 high = _allowedSelectors.length - 1;
        if (_selector < _allowedSelectors[low] || _selector > _allowedSelectors[high]) {
            return false;
        }
        while (low <= high) {
            uint256 mid = (low + high) / 2;
            if (_allowedSelectors[mid] == _selector) {
                return true;
            } else if (_allowedSelectors[mid] < _selector) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return false;
    }

    // ===================================================
    // ==================== Private ======================
    // ===================================================

    function _getAndValidateBalanceForAllForMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view returns (uint256) {
        IDolomiteStructs.Wei memory balanceWei = _vault.DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        Require.that(
            balanceWei.isPositive(),
            _FILE,
            "Invalid balance for transfer all"
        );
        return balanceWei.value;
    }

    function _checkAllowableCollateralMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view {
        // If the balance is positive, check that the collateral is for an allowable market. We use the Par balance
        // because, it uses less gas than getting the Wei balance, and we're only checking whether the balance is
        // positive.
        IDolomiteStructs.Par memory balancePar = _vault.DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isPositive()) {
            // Check the allowable collateral markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
            uint256[] memory allowableCollateralMarketIds = vaultFactory.allowableCollateralMarketIds();
            uint256 allowableCollateralsLength = allowableCollateralMarketIds.length;
            if (allowableCollateralsLength != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableCollateralsLength; i++) {
                    if (allowableCollateralMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as collateral",
                    _marketId
                );
            }
        }
    }

    function _checkAllowableDebtMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view {
        // If the balance is negative, check that the debt is for an allowable market. We use the Par balance because,
        // it uses less gas than getting the Wei balance, and we're only checking whether the balance is negative.
        IDolomiteStructs.Par memory balancePar = _vault.DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isNegative()) {
            // Check the allowable debt markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
            uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
            if (allowableDebtMarketIds.length != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableDebtMarketIds.length; i++) {
                    if (allowableDebtMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as debt",
                    _marketId
                );
            }
        }
    }

    function _checkMarketIdIsNotSelf(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _marketId
    ) private view {
        Require.that(
            _marketId != _vault.marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );
    }

    function _getAdjustedAccountValues(
        IDolomiteMargin _dolomiteMargin,
        BaseLiquidatorProxy.MarketInfo[] memory _marketInfos,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
        internal
        view
        returns (
            IDolomiteStructs.MonetaryValue memory supplyValue,
            IDolomiteStructs.MonetaryValue memory borrowValue
        )
    {
        return _getAccountValues(
            _dolomiteMargin,
            _marketInfos,
            _account,
            _marketIds,
            /* _adjustForMarginPremiums = */ true
        );
    }

    function _getAccountValues(
        IDolomiteMargin _dolomiteMargin,
        BaseLiquidatorProxy.MarketInfo[] memory _marketInfos,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        bool _adjustForMarginPremiums
    )
        internal
        view
        returns (
            IDolomiteStructs.MonetaryValue memory,
            IDolomiteStructs.MonetaryValue memory
        )
    {
        IDolomiteStructs.MonetaryValue memory supplyValue = IDolomiteStructs.MonetaryValue(0);
        IDolomiteStructs.MonetaryValue memory borrowValue = IDolomiteStructs.MonetaryValue(0);
        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteStructs.Par memory par = _dolomiteMargin.getAccountPar(_account, _marketIds[i]);
            BaseLiquidatorProxy.MarketInfo memory marketInfo = _binarySearch(_marketInfos, _marketIds[i]);
            IDolomiteStructs.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value * marketInfo.price.value;
            IDolomiteStructs.Decimal memory marginPremium = DecimalLib.one();
            if (_adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(_dolomiteMargin.getMarketMarginPremium(_marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value + DecimalLib.div(assetValue, marginPremium);
            } else {
                borrowValue.value = borrowValue.value + DecimalLib.mul(assetValue, marginPremium);
            }
        }
        return (supplyValue, borrowValue);
    }

    function _getMarketInfos(
        IDolomiteMargin _dolomiteMargin,
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) internal view returns (BaseLiquidatorProxy.MarketInfo[] memory) {
        uint[] memory marketBitmaps = BitsLib.createBitmaps(_dolomiteMargin.getNumMarkets());
        uint256 marketsLength = 0;
        marketsLength = _addMarketsToBitmap(_solidMarketIds, marketBitmaps, marketsLength);
        marketsLength = _addMarketsToBitmap(_liquidMarketIds, marketBitmaps, marketsLength);

        uint256 counter = 0;
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = new BaseLiquidatorProxy.MarketInfo[](marketsLength);
        for (uint256 i; i < marketBitmaps.length && counter != marketsLength; ++i) {
            uint256 bitmap = marketBitmaps[i];
            while (bitmap != 0) {
                uint256 nextSetBit = BitsLib.getLeastSignificantBit(bitmap);
                uint256 marketId = BitsLib.getMarketIdFromBit(i, nextSetBit);

                marketInfos[counter++] = BaseLiquidatorProxy.MarketInfo({
                    marketId: marketId,
                    price: _dolomiteMargin.getMarketPrice(marketId),
                    index: _dolomiteMargin.getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
        }

        return marketInfos;
    }


    function _checkFromAccountNumberIsZero(uint256 _fromAccountNumber) private pure {
        Require.that(
            _fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
    }

    function _checkToAccountNumberIsZero(uint256 _toAccountNumber) private pure {
        Require.that(
            _toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );
    }

    function _checkBorrowAccountNumberIsNotZero(
        uint256 _borrowAccountNumber,
        bool _bypassAccountNumberCheck
    ) private pure {
        if (!_bypassAccountNumberCheck) {
            Require.that(
                _borrowAccountNumber != 0,
                _FILE,
                "Invalid borrowAccountNumber",
                _borrowAccountNumber
            );
        }
    }

    function _addMarketsToBitmap(
        uint256[] memory _markets,
        uint256[] memory _bitmaps,
        uint256 _marketsLength
    ) private pure returns (uint) {
        for (uint256 i; i < _markets.length; ++i) {
            if (!BitsLib.hasBit(_bitmaps, _markets[i])) {
                BitsLib.setBit(_bitmaps, _markets[i]);
                _marketsLength += 1;
            }
        }
        return _marketsLength;
    }

    function _binarySearch(
        BaseLiquidatorProxy.MarketInfo[] memory _markets,
        uint256 _marketId
    ) internal pure returns (BaseLiquidatorProxy.MarketInfo memory) {
        return _binarySearch(
            _markets,
            /* _beginInclusive = */ 0,
            _markets.length,
            _marketId
        );
    }

    function _binarySearch(
        BaseLiquidatorProxy.MarketInfo[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) internal pure returns (BaseLiquidatorProxy.MarketInfo memory) {
        uint256 len = _endExclusive - _beginInclusive;
        if (len == 0 || (len == 1 && _markets[_beginInclusive].marketId != _marketId)) {
            revert("BaseLiquidatorProxy: Market not found"); // solhint-disable-line reason-string
        }

        uint256 mid = _beginInclusive + len / 2;
        uint256 midMarketId = _markets[mid].marketId;
        if (_marketId < midMarketId) {
            return _binarySearch(
                _markets,
                _beginInclusive,
                mid,
                _marketId
            );
        } else if (_marketId > midMarketId) {
            return _binarySearch(
                _markets,
                mid + 1,
                _endExclusive,
                _marketId
            );
        } else {
            return _markets[mid];
        }
    }

    function _isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteStructs.Decimal memory _ratio
    )
        private
        pure
        returns (bool)
    {
        uint256 requiredMargin = DecimalLib.mul(_borrowValue, _ratio);
        return _supplyValue >= _borrowValue + requiredMargin;
    }
}
