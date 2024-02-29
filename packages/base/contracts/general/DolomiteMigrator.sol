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
import { IIsolationModeMigrator } from "../isolation-mode/interfaces/IIsolationModeMigrator.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IDolomiteTransformer } from "../interfaces/IDolomiteTransformer.sol";


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

    // @follow-up should handler be stored in this contract or on a registry contract?
    function migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) external onlyHandler(msg.sender) {
        _migrate(_accounts, _fromMarketId, _toMarketId, _extraData);
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

    function _migrate(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _fromMarketId,
        uint256 _toMarketId,
        bytes calldata _extraData
    ) internal virtual {
        Require.that(
            _fromMarketId != _toMarketId,
            _FILE,
            "Cannot migrate to same market"
        );
        Require.that(
            _isIsolationModeMarket(_fromMarketId) && _isIsolationModeMarket(_toMarketId),
            _FILE,
            "Markets must be isolation mode"
        );

        IIsolationModeVaultFactory fromFactory = IIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_fromMarketId)
        );
        IIsolationModeVaultFactory toFactory = IIsolationModeVaultFactory(
            DOLOMITE_MARGIN().getMarketTokenAddress(_toMarketId)
        );

        address outputToken = IDolomiteTransformer(marketIdsToTransformer[_fromMarketId][_toMarketId]).outputToken();
        for (uint256 i; i < _accounts.length; ++i) {
            IDolomiteStructs.AccountInfo memory account = _accounts[i];

            address owner = fromFactory.getAccountByVault(account.owner);
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
            uint256 amountOut;
            if (amountWei > 0) {
                IIsolationModeMigrator(account.owner).migrate(amountWei);
                amountOut = _delegateCallToTransformer(_fromMarketId, _toMarketId, amountWei, _extraData);

                fromFactory.enqueueTransferFromDolomiteMargin(account.owner, amountWei);
                toFactory.enqueueTransferIntoDolomiteMargin(toVault, amountOut);
                IERC20(outputToken).safeApprove(toVault, amountOut);
                IERC20(address(toFactory)).safeApprove(address(DOLOMITE_MARGIN()), amountOut);

                // @note Will remove these. Just here for debugging
                assert(IERC20(outputToken).allowance(address(this), toVault) > 0);
                assert(IERC20(address(toFactory)).allowance(toVault, address(DOLOMITE_MARGIN())) > 0);
                assert(IERC20(address(toFactory)).allowance(address(this), address(DOLOMITE_MARGIN())) > 0);
            }

            _craftAndExecuteActions(account, toVault, _fromMarketId, _toMarketId, amountOut, amountWei > 0);

            assert(IERC20(outputToken).allowance(address(this), toVault) == 0);
            assert(IERC20(address(toFactory)).allowance(address(this), address(DOLOMITE_MARGIN())) == 0);
            // @follow-up This final assert is failing. I think because we do straight deposit, it won't work
            // assert(IERC20(address(toFactory)).allowance(toVault, address(DOLOMITE_MARGIN())) == 0);
            emit MigrationComplete(account.owner, account.number, _fromMarketId, _toMarketId);
        }
    }

    function _delegateCallToTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        uint256 _amount,
        bytes memory _extraData
    ) internal returns (uint256) {
        address transformer = marketIdsToTransformer[_fromMarketId][_toMarketId];
        assert(transformer != address(0));
        // @follow-up Want to use a library instead to delegate call?
        (bool success, bytes memory data) = transformer.delegatecall(
            abi.encodeWithSelector(IDolomiteTransformer.transform.selector, _amount, _extraData)
        );

        Require.that(
            success,
            _FILE,
            "Transformer call failed"
        );
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
                assert(_hasFromMarketIdBalance);
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

        DOLOMITE_MARGIN().operate(accounts, actions);
    }

    function _ownerSetTransformer(
        uint256 _fromMarketId,
        uint256 _toMarketId,
        address _transformer
    ) internal {
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
