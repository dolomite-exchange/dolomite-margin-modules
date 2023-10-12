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

import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { ExpirationLib } from "../lib/ExpirationLib.sol";
import { SimpleIsolationModeVaultFactory } from "../proxies/SimpleIsolationModeVaultFactory.sol";
import { FreezableIsolationModeVaultFactory } from "../proxies/abstract/FreezableIsolationModeVaultFactory.sol";


/**
 * @title   GmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GM token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GmxV2IsolationModeVaultFactory is
    IGmxV2IsolationModeVaultFactory,
    FreezableIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Immutable Variables ============

    address public immutable override SHORT_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override LONG_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override INDEX_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable INDEX_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 public immutable SHORT_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 public immutable LONG_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Field Variables ============

    IGmxRegistryV2 public override gmxRegistryV2;
    uint256 public override executionFee;

    // ============ Constructor ============

    constructor(
        address _gmxRegistryV2,
        uint256 _executionFee,
        MarketInfoConstructorParams memory _tokenAndMarketAddresses,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _tokenAndMarketAddresses.marketToken,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        _ownerSetGmxRegistryV2(_gmxRegistryV2);
        _ownerSetExecutionFee(_executionFee);
        INDEX_TOKEN = _tokenAndMarketAddresses.indexToken;
        INDEX_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(INDEX_TOKEN);
        SHORT_TOKEN = _tokenAndMarketAddresses.shortToken;
        SHORT_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(SHORT_TOKEN);
        LONG_TOKEN = _tokenAndMarketAddresses.longToken;
        LONG_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(LONG_TOKEN);

        if (_initialAllowableDebtMarketIds.length == 2) { /* FOR COVERAGE TESTING */ }
        Require.that(_initialAllowableDebtMarketIds.length == 2,
            _FILE,
            "Invalid debt market ids"
        );
        if ((_initialAllowableDebtMarketIds[0] == LONG_TOKEN_MARKET_ID&& _initialAllowableDebtMarketIds[1] == SHORT_TOKEN_MARKET_ID)|| (_initialAllowableDebtMarketIds[0] == SHORT_TOKEN_MARKET_ID&& _initialAllowableDebtMarketIds[1] == LONG_TOKEN_MARKET_ID)) { /* FOR COVERAGE TESTING */ }
        Require.that((_initialAllowableDebtMarketIds[0] == LONG_TOKEN_MARKET_ID
                && _initialAllowableDebtMarketIds[1] == SHORT_TOKEN_MARKET_ID)
            || (_initialAllowableDebtMarketIds[0] == SHORT_TOKEN_MARKET_ID
                && _initialAllowableDebtMarketIds[1] == LONG_TOKEN_MARKET_ID),
            _FILE,
            "Invalid debt market ids"
        );

        if (_initialAllowableCollateralMarketIds.length == 2) { /* FOR COVERAGE TESTING */ }
        Require.that(_initialAllowableCollateralMarketIds.length == 2,
            _FILE,
            "Invalid collateral market ids"
        );
        if ((_initialAllowableCollateralMarketIds[0] == LONG_TOKEN_MARKET_ID&& _initialAllowableCollateralMarketIds[1] == SHORT_TOKEN_MARKET_ID)|| (_initialAllowableCollateralMarketIds[0] == SHORT_TOKEN_MARKET_ID&& _initialAllowableCollateralMarketIds[1] == LONG_TOKEN_MARKET_ID)) { /* FOR COVERAGE TESTING */ }
        Require.that((_initialAllowableCollateralMarketIds[0] == LONG_TOKEN_MARKET_ID
                && _initialAllowableCollateralMarketIds[1] == SHORT_TOKEN_MARKET_ID)
            || (_initialAllowableCollateralMarketIds[0] == SHORT_TOKEN_MARKET_ID
                && _initialAllowableCollateralMarketIds[1] == LONG_TOKEN_MARKET_ID),
            _FILE,
            "Invalid collateral market ids"
        );
    }

    // ================================================
    // ============ External Functions ============
    // ================================================

    function depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _depositIntoDolomiteMarginFromTokenConverter(
            _vault,
            _vaultAccountNumber,
            _amountWei
        );
    }

    function depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _otherMarketId,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
            _vault,
            _vaultAccountNumber,
            _otherMarketId,
            _amountWei
        );
    }

    function withdrawFromDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        _withdrawFromDolomiteMarginFromTokenConverter(
            _vault,
            _vaultAccountNumber,
            _amountWei
        );
    }

    function ownerSetGmxRegistryV2(
        address _gmxRegistryV2
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxRegistryV2(_gmxRegistryV2);
    }

    function ownerSetExecutionFee(
        uint256 _executionFee
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetExecutionFee(_executionFee);
    }

    function setIsDepositSourceWrapper(
        address _vault,
        bool _isDepositSourceWrapper
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVaultV1(_vault).setIsDepositSourceWrapper(_isDepositSourceWrapper);
    }

    function setShouldSkipTransfer(
        address _vault,
        bool _shouldSkipTransfer
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVaultV1(_vault).setShouldSkipTransfer(_shouldSkipTransfer);
    }

    function clearExpirationIfNeeded(
        address _vault,
        uint256 _accountNumber,
        uint256 _owedMarketId
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        ExpirationLib.clearExpirationIfNeeded(
            DOLOMITE_MARGIN(),
            gmxRegistryV2.dolomiteRegistry(),
            _vault,
            _accountNumber,
            _owedMarketId
        );
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _ownerSetGmxRegistryV2(
        address _gmxRegistryV2
    ) internal {
        gmxRegistryV2 = IGmxRegistryV2(_gmxRegistryV2);
        emit GmxRegistryV2Set(_gmxRegistryV2);
    }

    function _ownerSetExecutionFee(
        uint256 _executionFee
    ) internal {
        if (_executionFee <= 1 ether) { /* FOR COVERAGE TESTING */ }
        Require.that(_executionFee <= 1 ether,
            _FILE,
            "Invalid execution fee"
        );
        executionFee = _executionFee;
        emit ExecutionFeeSet(_executionFee);
    }

    function _depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) internal virtual {
        IGmxV2IsolationModeTokenVaultV1(_vault).setIsDepositSourceWrapper(/* _isDepositSourceWrapper = */ true);
        _enqueueTransfer(
            _vault,
            address(DOLOMITE_MARGIN()),
            _amountWei,
            _vault
        );
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ _vault,
            /* _fromAccount = */ _vault,
            _vaultAccountNumber,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
    }

    function _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _otherMarketId,
        uint256 _amountWei
    ) internal {
        if (_otherMarketId != marketId) { /* FOR COVERAGE TESTING */ }
        Require.that(_otherMarketId != marketId,
            _FILE,
            "Invalid market",
            _otherMarketId
        );

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[0] = IDolomiteStructs.AccountInfo({
            owner: _vault,
            number: _vaultAccountNumber
        });
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);

        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_otherMarketId);
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amountWei);
        IERC20(token).safeApprove(address(DOLOMITE_MARGIN()), _amountWei);

        actions[0] = AccountActionLib.encodeDepositAction(
        /* _accountId = */ 0,
            _otherMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            /* _fromAccount = */ address(this)
        );
        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _withdrawFromDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) internal {
        _enqueueTransfer(
            address(DOLOMITE_MARGIN()),
            _vault,
            _amountWei,
            _vault
        );
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            _vault,
            _vaultAccountNumber,
            _vault,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );
    }

    function _afterInitialize() internal override {
        _allowableCollateralMarketIds.push(marketId);
    }
}