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
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMigrator } from "../interfaces/IDolomiteMigrator.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IDolomiteTransformer } from "../interfaces/IDolomiteTransformer.sol";
import { IIsolationModeTokenVaultMigrator } from "../isolation-mode/interfaces/IIsolationModeTokenVaultMigrator.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";


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

    mapping(uint256 => mapping(uint256 => Transformer)) private _marketIdsToTransformer;

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

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
        address _dolomiteRegistry,
        address _handler,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        _ownerSetHandler(_handler);
    }

    // ================================================
    // =================== Functions ==================
    // ================================================

    function migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) external onlyHandler(msg.sender) {
        _checkMarketIds(_fromMarketId, _toMarketId, /* _soloCall = */ false);
        _migrate(_accounts, _fromMarketId, _toMarketId, _extraData);
    }

    function selfMigrate(
        uint256 _accountNumber,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) external {
        _checkMarketIds(_fromMarketId, _toMarketId, /* _soloCall = */ true);

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](1);
        accounts[0] = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _accountNumber
        });
        _migrate(accounts, _fromMarketId, _toMarketId, _extraData);
    }

    function ownerSetTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        address _transformer,
        bool _soloAllowable
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetTransformer(_fromMarketId, _toMarketId, _transformer, _soloAllowable);
    }

    function ownerSetHandler(
        address _handler
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler);
    }

    function getTransformerByMarketIds(
        uint256 _fromMarketId,
        uint256 _toMarketId
    ) external view returns (Transformer memory) {
        return _marketIdsToTransformer[_fromMarketId][_toMarketId];
    }

    // ================================================
    // ================ Internal Functions ============
    // ================================================

    function _migrate(
        IDolomiteStructs.AccountInfo[] memory _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes memory _extraData
    ) internal virtual {
        IIsolationModeVaultFactory fromFactory = IIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_fromMarketId)
        );
        IIsolationModeVaultFactory toFactory = IIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_toMarketId)
        );

        IDolomiteTransformer transformer = IDolomiteTransformer(
            _marketIdsToTransformer[_fromMarketId][_toMarketId].transformer
        );
        IERC20 outputToken = IERC20(transformer.outputToken());

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

            uint256 fromMarketId = _fromMarketId;
            uint256 toMarketId = _toMarketId;
            bytes memory extraData = _extraData;
            uint256 amountWei = DOLOMITE_MARGIN().getAccountWei(account, fromMarketId).value;
            uint256 amountOut;

            if (amountWei > 0) {
                {
                    uint256 preBalance = IERC20(transformer.inputToken()).balanceOf(address(this));
                    IIsolationModeTokenVaultMigrator(account.owner).migrate(amountWei);
                    uint256 postBalance = IERC20(transformer.inputToken()).balanceOf(address(this));
                    /*assert(postBalance - preBalance == amountWei);*/

                    preBalance = outputToken.balanceOf(address(this));
                    amountOut = _transformAndGetAmountOut(fromMarketId, toMarketId, amountWei, extraData);
                    postBalance = outputToken.balanceOf(address(this));
                    /*assert(postBalance - preBalance == amountOut);*/
                }


                fromFactory.enqueueTransferFromDolomiteMargin(account.owner, amountWei);
                toFactory.enqueueTransferIntoDolomiteMargin(toVault, amountOut);
                outputToken.safeApprove(toVault, amountOut);
                IERC20(address(toFactory)).safeApprove(address(DOLOMITE_MARGIN()), amountOut);
            }

            // Even if the amount in this sub account is 0, we still need to transfer the position (which could contain
            // other assets)
            _craftAndExecuteActions(
                account,
                toVault,
                fromMarketId,
                toMarketId,
                amountOut,
                /* _hasFromMarketIdBalance */ amountWei > 0
            );

            /*assert(outputToken.allowance(address(this), toVault) == 0);*/
            /*assert(IERC20(address(toFactory)).allowance(address(this), address(DOLOMITE_MARGIN())) == 0);*/
            if (amountWei > 0) {
                IIsolationModeVaultFactory.QueuedTransfer memory transfer = fromFactory.getQueuedTransferByCursor(
                    fromFactory.transferCursor()
                );
                /*assert(transfer.isExecuted);*/
                transfer = toFactory.getQueuedTransferByCursor(toFactory.transferCursor());
                /*assert(transfer.isExecuted);*/
            }

            emit MigrationComplete(account.owner, account.number, fromMarketId, toMarketId);
        }
    }

    function _transformAndGetAmountOut(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        uint256 _amount,
        bytes memory _extraData
    ) internal returns (uint256) {
        address transformer = _marketIdsToTransformer[_fromMarketId][_toMarketId].transformer;
        /*assert(transformer != address(0));*/
        (bool success, bytes memory data) = transformer.delegatecall(
            abi.encodeWithSelector(IDolomiteTransformer.transform.selector, _amount, _extraData)
        );

        if (success) { /* FOR COVERAGE TESTING */ }
        Require.that(
            success,
            _FILE,
            "Transformer call failed"
        );
        if (data.length == 32) { /* FOR COVERAGE TESTING */ }
        Require.that(
            data.length == 32,
            _FILE,
            "Invalid return data"
        );

        return abi.decode(data, (uint256));
    }

    function _craftAndExecuteActions(
        IDolomiteStructs.AccountInfo memory _account,
        address _toVault,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        uint256 _amount,
        bool _hasFromMarketIdBalance
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

        uint256[] memory marketsWithBalances = DOLOMITE_MARGIN().getAccountMarketsWithBalances(_account);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _hasFromMarketIdBalance ? marketsWithBalances.length + 1 : marketsWithBalances.length
        );
        if (actions.length > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            actions.length > 0,
            _FILE,
            "No actions to execute"
        );

        if (_hasFromMarketIdBalance) {
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
        }

        uint256 counter = _hasFromMarketIdBalance ? 2 : 0;
        for (uint256 j; j < marketsWithBalances.length; ++j) {
            if (marketsWithBalances[j] == _fromMarketId) {
                /*assert(_hasFromMarketIdBalance);*/
                continue;
            }
            actions[counter++] = AccountActionLib.encodeTransferAction(
                /* fromAccountId = */ 0,
                /* toAccountId = */ 1,
                /* marketId = */ marketsWithBalances[j],
                /* amountDenomination = */ IDolomiteStructs.AssetDenomination.Wei,
                /* amount = */ type(uint256).max
            );
        }

        if (_account.number > 100) {
            DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(_toVault, _account.number);
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _checkMarketIds(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bool _soloCall
    ) internal view {
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

        if (_soloCall) {
            if (_marketIdsToTransformer[_fromMarketId][_toMarketId].soloAllowable) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _marketIdsToTransformer[_fromMarketId][_toMarketId].soloAllowable,
                _FILE,
                "Solo migration not allowed"
            );
        }
    }

    function _ownerSetTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        address _transformer,
        bool _soloAllowable
    ) internal {
        if (_transformer != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _transformer != address(0),
            _FILE,
            "Invalid transformer"
        );

        _marketIdsToTransformer[_fromMarketId][_toMarketId] = Transformer({
            transformer: _transformer,
            soloAllowable: _soloAllowable
        });
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
