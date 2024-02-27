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

import { IDolomiteMigrator } from "../interfaces/IDolomiteMigrator.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IIsolationModeMigrator } from "../isolation-mode/interfaces/IIsolationModeMigrator.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import "hardhat/console.sol";

/**
 * @title   DolomiteMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for converting isolation mode assets to another market
 */
contract DolomiteMigrator is IDolomiteMigrator, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteMigrator";

    // ================================================
    // =================== State Variables ============
    // ================================================

    mapping(uint256 => mapping(uint256 => address)) public marketIdsToTransformer;
    address public handler;

    // ================================================
    // =================== Modifiers ==================
    // ================================================

    modifier onlyHandler(address _from) {
        if (_from == handler) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _from == handler,
            _FILE,
            'Caller is not handler'
        );
        _;
    }

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        address _dolomiteMargin,
        address _handler
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _ownerSetHandler(_handler);
    }

    // ================================================
    // =================== Functions ==================
    // ================================================

    // @follow-up Who to make this callable by? valid handlers
    function migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId
    ) external onlyHandler(msg.sender) {
        if (_fromMarketId != _toMarketId) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _fromMarketId != _toMarketId,
            _FILE,
            "Cannot migrate to same market"
        );
        if (_isIsolationModeMarket(_fromMarketId) && _isIsolationModeMarket(_toMarketId)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isIsolationModeMarket(_fromMarketId) && _isIsolationModeMarket(_toMarketId),
            _FILE,
            "Markets must be isolation mode"
        );

        IIsolationModeVaultFactory fromFactory = IIsolationModeVaultFactory(DOLOMITE_MARGIN().getMarketTokenAddress(_fromMarketId));
        IIsolationModeVaultFactory toFactory = IIsolationModeVaultFactory(DOLOMITE_MARGIN().getMarketTokenAddress(_toMarketId));

        for (uint256 i; i < _accounts.length; ++i) {
            IDolomiteStructs.AccountInfo memory account = _accounts[i];
            address owner = fromFactory.getAccountByVault(account.owner);
            if (owner != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                owner != address(0),
                _FILE,
                "Invalid vault"
            );
            address toVault = toFactory.getVaultByAccount(owner);
            if (toVault == address(0)) {
                toVault = toFactory.createVault(owner);
            }

            uint256 amountWei = DOLOMITE_MARGIN().getAccountWei(account, _fromMarketId).value;
            IIsolationModeMigrator(account.owner).migrate(amountWei);
            fromFactory.enqueueTransferFromDolomiteMargin(account.owner, amountWei);

            uint256 amountOut = _delegateCallToTransformer(_fromMarketId, _toMarketId, amountWei);

            toFactory.enqueueTransferIntoDolomiteMargin(toVault, amountOut);
            IERC20(toFactory.UNDERLYING_TOKEN()).safeApprove(toVault, amountOut);
            IERC20(address(toFactory)).safeApprove(address(DOLOMITE_MARGIN()), amountOut);

            _craftAndExecuteActions(account, toVault, _fromMarketId, _toMarketId, amountOut);
            emit MigrationComplete(account.owner, account.number, _fromMarketId, _toMarketId);
        }
    }

    function ownerSetTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        address _transformer
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetTransformer(_fromMarketId, _toMarketId, _transformer);
    }

    function ownerSetHandler(
        address _handler
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler);
    }

    // ================================================
    // ================ Internal Functions ============
    // ================================================

    function _delegateCallToTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        uint256 _amount
    ) internal returns (uint256) {
        address transformer = marketIdsToTransformer[_fromMarketId][_toMarketId];
        // @follow-up Want to use a library instead to delegate call?
        (bool success, bytes memory data) = transformer.delegatecall(
            abi.encodeWithSignature("transform(uint256)", _amount)
        );
        if (success) { /* FOR COVERAGE TESTING */ }
        Require.that(
            success,
            _FILE,
            "Transformer call failed"
        );
        return abi.decode(data, (uint256));
    }

    function _craftAndExecuteActions(
        IDolomiteStructs.AccountInfo memory _account,
        address _toVault,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        uint256 _amount
    ) internal {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
        accounts[0] = IDolomiteStructs.AccountInfo({
            owner: _account.owner,
            number: _account.number
        });
        accounts[1] = IDolomiteStructs.AccountInfo({
            owner: _toVault,
            number: _account.number
        });

        // @follow-up Design of the full contract, but also this part with the counter
        uint256[] memory marketsWithBalances = DOLOMITE_MARGIN().getAccountMarketsWithBalances(_account);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](marketsWithBalances.length + 1);
        uint256 counter = 2;

        for (uint256 j; j < marketsWithBalances.length; ++j) {
            if (marketsWithBalances[j] == _fromMarketId) {
                continue;
            }
            actions[counter] = AccountActionLib.encodeTransferAction(
                /* fromAccountId = */ 0,
                /* toAccountId = */ 1,
                /* marketId = */ marketsWithBalances[j],
                /* amountDenomination = */ IDolomiteStructs.AssetDenomination.Wei,
                /* amount = */ type(uint256).max
            );
            ++counter;
        }
        actions[0] = AccountActionLib.encodeWithdrawalAction(
            /* _accountId = */ 0,
            _fromMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Target,
                value: 0
            }),
            /* _toAccount = */ address(this)
        );
        actions[1] = AccountActionLib.encodeDepositAction(
            /* _accountId = */ 1,
            _toMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            }),
            /* _fromAccount = */ address(this)
        );

        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _ownerSetTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        address _transformer
    ) internal {
        if (_transformer != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _transformer != address(0),
            _FILE,
            "Invalid transformer"
        );

        marketIdsToTransformer[_fromMarketId][_toMarketId] = _transformer;
        emit TransformerSet(_fromMarketId, _toMarketId, _transformer);
    }

    function _ownerSetHandler(
        address _handler
    ) internal {
        handler = _handler;
        emit HandlerSet(_handler);
    }

    function _isIsolationModeMarket(
        uint256 _marketId
    ) internal view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            DOLOMITE_MARGIN().getMarketTokenAddress(_marketId),
            IIsolationModeVaultFactory.isIsolationAsset.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }
        return abi.decode(returnData, (bool));
    }
}
