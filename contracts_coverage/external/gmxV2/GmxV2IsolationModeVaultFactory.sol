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
import { Require } from "../../protocol/lib/Require.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IGmxV2IsolationModeTokenVault } from "../interfaces/gmx/IGmxV2IsolationModeTokenVault.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
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
    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IGmxRegistryV2 public override gmxRegistryV2;
    address public immutable initialShortToken;
    uint256 public immutable initialShortTokenMarketId;
    address public immutable initialLongToken;
    uint256 public immutable initialLongTokenMarketId;

    // ============ Constructor ============

    constructor(
        address _gmxRegistryV2,
        address _initialShortToken,
        uint256 _initialShortTokenMarketId,
        address _initialLongToken,
        uint256 _initialLongTokenMarketId,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _gm, // this serves as the underlying token
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _gm,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        gmxRegistryV2 = IGmxRegistryV2(_gmxRegistryV2);
        initialShortToken = _initialShortToken;
        initialShortTokenMarketId = _initialShortTokenMarketId;
        initialLongToken = _initialLongToken;
        initialLongTokenMarketId = _initialLongTokenMarketId;
    }

    // ================================================
    // ============ External Functions ============
    // ================================================

    function ownerSetGmxRegistryV2(
        address _gmxRegistryV2
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        gmxRegistryV2 = IGmxRegistryV2(_gmxRegistryV2);
        emit GmxRegistryV2Set(_gmxRegistryV2);
    }

    function depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVault(_vault).setSourceIsWrapper(true);
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
        IERC20(token).transferFrom(msg.sender, address(this), _amountWei);
        IERC20(token).approve(address(DOLOMITE_MARGIN()), _amountWei);
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

    function setSourceIsWrapper(
        address _vault,
        bool _sourceIsWrapper
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVault(_vault).setSourceIsWrapper(_sourceIsWrapper);
    }

    function setShouldSkipTransfer(
        address _vault,
        bool _shouldSkipTransfer
    )
    external
    requireIsTokenConverter(msg.sender)
    requireIsVault(_vault) {
        IGmxV2IsolationModeTokenVault(_vault).setShouldSkipTransfer(_shouldSkipTransfer);
    }
}
