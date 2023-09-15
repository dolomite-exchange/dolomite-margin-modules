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
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { SimpleIsolationModeVaultFactory } from "../proxies/SimpleIsolationModeVaultFactory.sol";


/**
 * @title   GmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GM token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GmxV2IsolationModeVaultFactory is
    IGmxV2IsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Immutable Variables ============

    address public immutable override SHORT_TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable override LONG_TOKEN; // solhint-disable-line var-name-mixedcase
    address private immutable _INDEX_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 private immutable _INDEX_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 private immutable _SHORT_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase
    uint256 private immutable _LONG_TOKEN_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Field Variables ============

    IGmxRegistryV2 public override gmxRegistryV2;

    // ============ Constructor ============

    constructor(
        address _gmxRegistryV2,
        TokenAndMarketAddresses memory _tokenAndMarketAddresses,
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
        gmxRegistryV2 = IGmxRegistryV2(_gmxRegistryV2);
        _INDEX_TOKEN = _tokenAndMarketAddresses.indexToken;
        _INDEX_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_INDEX_TOKEN);
        SHORT_TOKEN = _tokenAndMarketAddresses.shortToken;
        _SHORT_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(SHORT_TOKEN);
        LONG_TOKEN = _tokenAndMarketAddresses.longToken;
        _LONG_TOKEN_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(LONG_TOKEN);

        Require.that(
            _initialAllowableDebtMarketIds.length == 2,
            _FILE,
            "Invalid debt market ids"
        );
        Require.that(
            (_initialAllowableDebtMarketIds[0] == _LONG_TOKEN_MARKET_ID
                && _initialAllowableDebtMarketIds[1] == _SHORT_TOKEN_MARKET_ID)
            || (_initialAllowableDebtMarketIds[0] == _SHORT_TOKEN_MARKET_ID
                && _initialAllowableDebtMarketIds[1] == _LONG_TOKEN_MARKET_ID),
            _FILE,
            "Invalid debt market ids"
        );

        Require.that(
            _initialAllowableCollateralMarketIds.length == 2,
            _FILE,
            "Invalid collateral market ids"
        );
        Require.that(
            (_initialAllowableCollateralMarketIds[0] == _LONG_TOKEN_MARKET_ID
                && _initialAllowableCollateralMarketIds[1] == _SHORT_TOKEN_MARKET_ID)
            || (_initialAllowableCollateralMarketIds[0] == _SHORT_TOKEN_MARKET_ID
                && _initialAllowableCollateralMarketIds[1] == _LONG_TOKEN_MARKET_ID),
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
        IGmxV2IsolationModeTokenVaultV1(_vault).setIsDepositSourceWrapper(true);
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

    function depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _otherMarketId,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        Require.that(
            _otherMarketId != marketId,
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

    function withdrawFromDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
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

    function ownerSetGmxRegistryV2(
        address _gmxRegistryV2
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        gmxRegistryV2 = IGmxRegistryV2(_gmxRegistryV2);
        emit GmxRegistryV2Set(_gmxRegistryV2);
    }

    function setIsVaultFrozen(
        address _vault,
        bool _isVaultFrozen
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVaultV1(_vault).setIsVaultFrozen(_isVaultFrozen);
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

    // @follow-up Should we add a view function to return all market info?
    function getMarketInfo() external view returns (TokenAndMarketParams memory) {
        return TokenAndMarketParams({
            marketToken: UNDERLYING_TOKEN,
            indexToken: _INDEX_TOKEN,
            indexTokenMarketId: _INDEX_TOKEN_MARKET_ID,
            shortToken: SHORT_TOKEN,
            shortTokenMarketId: _SHORT_TOKEN_MARKET_ID,
            longToken: LONG_TOKEN,
            longTokenMarketId: _LONG_TOKEN_MARKET_ID
        });
    }

    // ====================================================
    // ================ Internal Functions ================
    // ====================================================

    function _afterInitialize() internal override {
        _allowableCollateralMarketIds.push(marketId);
    }
}
