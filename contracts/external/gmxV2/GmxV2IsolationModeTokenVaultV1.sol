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
import { IGmxV2Registry } from "./GmxV2Registry.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezable.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import { BaseLiquidatorProxy } from "../general/BaseLiquidatorProxy.sol";
import { BitsLib } from "../../protocol/lib/BitsLib.sol";
import { DecimalLib } from "../../protocol/lib/DecimalLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds any GMX V2 Market token that and
 *          can be used to credit a user's Dolomite balance.
 * @dev     In certain cases, GM tokens may be refunded to the vault owner.
 *          The vault owner MUST be able to handle GM tokens
 */
contract GmxV2IsolationModeTokenVaultV1 is
    IGmxV2IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(address _weth) IsolationModeTokenVaultV1WithFreezable(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    // @audit Need to check this can't be used to unfreeze the vault with a dummy deposit. I don't think it can
    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper =
                                registry().getWrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()));
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

    function isExternalRedemptionPaused()
        public
        override
        view
        returns (bool)
    {
        return GmxV2Library.isExternalRedemptionPaused(
            registry(),
            DOLOMITE_MARGIN(),
            IGmxV2IsolationModeVaultFactory(VAULT_FACTORY())
        );
    }

    function registry() public view returns (IGmxV2Registry) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxV2Registry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        GmxV2Library.validateExecutionFee(/* _vault = */ this, _toAccountNumber);
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
        _setExecutionFeeForAccountNumber(_toAccountNumber, msg.value);
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    internal
    override {
        Require.that(
            getExecutionFeeForAccountNumber(_borrowAccountNumber) != 0,
            _FILE,
            "Missing execution fee"
        );
        super._transferIntoPositionWithUnderlyingToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        );
    }

    /**
     *
     *  @dev  _minOutputAmountWei MUST BE greater than 0 or call will revert
     */
    function _swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    virtual
    override {
        uint256 len = _tradersPath.length;
        if (_tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            GmxV2Library.depositAndApproveWethForWrapping(this);
            Require.that(
                msg.value <= IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).MAX_EXECUTION_FEE(),
                _FILE,
                "Invalid execution fee"
            );
            _tradersPath[len - 1].tradeData = abi.encode(_tradeAccountNumber, abi.encode(msg.value));
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }

        if (_tradersPath[0].traderType == IGenericTraderBase.TraderType.IsolationModeUnwrapper || isVaultFrozen()) {
            // Only a trusted converter can initiate unwraps (via the callback) OR execute swaps if the vault is frozen
            _requireOnlyConverter(msg.sender);
        }

        // Ignore the freezable implementation and call the pausable one directly
        IsolationModeTokenVaultV1WithPausable._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal override {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY());
        Require.that(
            registry().getUnwrapperByToken(factory).isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );

        Require.that(
            msg.value <= IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).MAX_EXECUTION_FEE(),
            _FILE,
            "Invalid execution fee"
        );
        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IIsolationModeVaultFactory(VAULT_FACTORY()));
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(unwrapper), _inputAmount);
        unwrapper.vaultInitiateUnwrapping{ value: ethExecutionFee }(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function _validateVaultOwnerForStruct(address _vault) internal view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
        );
    }

    function _checkIsLiquidatable(
        uint256 _liquidAccountNumber
    ) internal view {
        IDolomiteStructs.AccountInfo memory liquidAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _liquidAccountNumber
        });
        uint256[] memory marketsWithBalances = DOLOMITE_MARGIN().getAccountMarketsWithBalances(liquidAccount);
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = _getMarketInfos(
            /* _solidMarketIds = */ new uint256[](0),
            marketsWithBalances
        );
        (
            IDolomiteStructs.MonetaryValue memory liquidSupplyValue,
            IDolomiteStructs.MonetaryValue memory liquidBorrowValue
        ) = _getAdjustedAccountValues(
            marketInfos,
            liquidAccount,
            marketsWithBalances
        );

        // Panic if there's no supply value
        Require.that(
            liquidSupplyValue.value != 0,
            _FILE,
            "Liquid account has no supply"
        );

        IDolomiteStructs.Decimal memory marginRatio = DOLOMITE_MARGIN().getMarginRatio();
        Require.that(
            DOLOMITE_MARGIN().getAccountStatus(liquidAccount) == IDolomiteStructs.AccountStatus.Liquid
                || !_isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio),
            _FILE,
            "Liquid account not liquidatable"
        );
    }

    function _getAdjustedAccountValues(
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
            _marketInfos,
            _account,
            _marketIds,
            /* _adjustForMarginPremiums = */ true
        );
    }

    function _getAccountValues(
        BaseLiquidatorProxy.MarketInfo[] memory _marketInfos,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        bool _adjustForMarginPremiums
    )
        private
        view
        returns (
            IDolomiteStructs.MonetaryValue memory supplyValue,
            IDolomiteStructs.MonetaryValue memory borrowValue
        )
    {
        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteStructs.Par memory par = DOLOMITE_MARGIN().getAccountPar(_account, _marketIds[i]);
            BaseLiquidatorProxy.MarketInfo memory marketInfo = _binarySearch(_marketInfos, _marketIds[i]);
            IDolomiteStructs.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value * marketInfo.price.value;
            IDolomiteStructs.Decimal memory marginPremium = DecimalLib.one();
            if (_adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(DOLOMITE_MARGIN().getMarketMarginPremium(_marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value + DecimalLib.div(assetValue, marginPremium);
            } else {
                borrowValue.value = borrowValue.value + DecimalLib.mul(assetValue, marginPremium);
            }
        }
    }


    function _checkMsgValue() internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Don't do any validation here. We check the msg.value conditionally in the `swapExactInputForOutput`
        // implementation
    }

    function _getMarketInfos(
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) internal view returns (BaseLiquidatorProxy.MarketInfo[] memory) {
        uint[] memory marketBitmaps = BitsLib.createBitmaps(DOLOMITE_MARGIN().getNumMarkets());
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
                    price: DOLOMITE_MARGIN().getMarketPrice(marketId),
                    index: DOLOMITE_MARGIN().getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
        }

        return marketInfos;
    }

     function _isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteStructs.Decimal memory _ratio
    )
        internal
        pure
        returns (bool)
    {
        uint256 requiredMargin = DecimalLib.mul(_borrowValue, _ratio);
        return _supplyValue >= _borrowValue + requiredMargin;
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
    ) private pure returns (BaseLiquidatorProxy.MarketInfo memory) {
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
}
