// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IIsolationModeUnwrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IIsolationModeWrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeWrapperTraderV2.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IGenericTraderProxyV2 } from "./interfaces/IGenericTraderProxyV2.sol";


/**
 * @title   GenericTraderProxyV2Lib
 * @author  Dolomite
 *
 * @notice  Library contract for reducing code size of the GenericTraderRouter contract
 */
library GenericTraderProxyV2Lib {
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "GenericTraderProxyV2Lib";

    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";

    // ============ Public Functions ============

    function validateTraderParams(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderBase.TraderParam[] memory _traderParamsPath
    ) public view {
        if (_marketIdsPath.length == _traderParamsPath.length + 1) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketIdsPath.length == _traderParamsPath.length + 1,
            _FILE,
            "Invalid traders params length"
        );

        uint256 traderParamsPathLength = _traderParamsPath.length;
        for (uint256 i; i < traderParamsPathLength; ++i) {
            validateTraderParam(
                _cache,
                _marketIdsPath,
                _makerAccounts,
                _traderParamsPath[i],
                /* _index = */ i // solium-disable-line indentation
            );
        }
    }

    function validateTraderParam(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderBase.TraderParam memory _traderParam,
        uint256 _index
    ) public view {
        if (_traderParam.trader != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _traderParam.trader != address(0),
            _FILE,
            "Invalid trader at index",
            _index
        );

        uint256 marketId = _marketIdsPath[_index];
        uint256 nextMarketId = _marketIdsPath[_index + 1];
        validateIsolationModeStatusForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam
        );
        validateTraderTypeForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam,
            _index
        );
        validateMakerAccountForTraderParam(
            _makerAccounts,
            _traderParam,
            _index
        );
    }

    function validateIsolationModeStatusForTraderParam(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        IGenericTraderBase.TraderParam memory _traderParam
    ) public view {
        if (isIsolationModeMarket(_cache.dolomiteMargin, _marketId)) {
            // If the current market is in isolation mode, the trader type must be for isolation mode assets
            if (_isUnwrapperTraderType(_traderParam.traderType)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _isUnwrapperTraderType(_traderParam.traderType),
                _FILE,
                "Invalid isolation mode unwrapper",
                _marketId,
                uint256(uint8(_traderParam.traderType))
            );

            if (isIsolationModeMarket(_cache.dolomiteMargin, _nextMarketId)) {
                // If the user is unwrapping into an isolation mode asset, the next market must trust this trader
                address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
                if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                    _FILE,
                    "Invalid unwrap sequence",
                    _marketId,
                    _nextMarketId
                );
            }
        } else if (isIsolationModeMarket(_cache.dolomiteMargin, _nextMarketId)) {
            // If the next market is in isolation mode, the trader must wrap the current asset into the isolation asset.
            if (_isWrapperTraderType(_traderParam.traderType)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _isWrapperTraderType(_traderParam.traderType),
                _FILE,
                "Invalid isolation mode wrapper",
                _nextMarketId,
                uint256(uint8(_traderParam.traderType))
            );
        } else {
            // If neither asset is in isolation mode, the trader type must be for non-isolation mode assets
            if (_traderParam.traderType == IGenericTraderBase.TraderType.ExternalLiquidity || _traderParam.traderType == IGenericTraderBase.TraderType.InternalLiquidity) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.traderType == IGenericTraderBase.TraderType.ExternalLiquidity
                    || _traderParam.traderType == IGenericTraderBase.TraderType.InternalLiquidity,
                _FILE,
                "Invalid trader type",
                uint256(uint8(_traderParam.traderType))
            );
        }
    }

    function validateTraderTypeForTraderParam(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        IGenericTraderBase.TraderParam memory _traderParam,
        uint256 _index
    ) public view {
        if (_isUnwrapperTraderType(_traderParam.traderType)) {
            IIsolationModeUnwrapperTraderV2 unwrapperTrader = IIsolationModeUnwrapperTraderV2(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_marketId);
            if (unwrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(
                unwrapperTrader.token() == isolationModeToken,
                _FILE,
                "Invalid input for unwrapper",
                _index,
                _marketId
            );
            if (unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(
                unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId)),
                _FILE,
                "Invalid output for unwrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                _FILE,
                "Unwrapper trader not enabled",
                _traderParam.trader,
                _marketId
            );
        } else if (_isWrapperTraderType(_traderParam.traderType)) {
            IIsolationModeWrapperTraderV2 wrapperTrader = IIsolationModeWrapperTraderV2(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
            if (wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(
                wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId)),
                _FILE,
                "Invalid input for wrapper",
                _index,
                _marketId
            );
            if (wrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(
                wrapperTrader.token() == isolationModeToken,
                _FILE,
                "Invalid output for wrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                _FILE,
                "Wrapper trader not enabled",
                _traderParam.trader,
                _nextMarketId
            );
        }
    }

    function validateMakerAccountForTraderParam(
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderBase.TraderParam memory _traderParam,
        uint256 _index
    ) public pure {
        if (IGenericTraderBase.TraderType.InternalLiquidity == _traderParam.traderType) {
            // The makerAccountOwner should be set if the traderType is InternalLiquidity
            if (_traderParam.makerAccountIndex < _makerAccounts.length && _makerAccounts[_traderParam.makerAccountIndex].owner != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.makerAccountIndex < _makerAccounts.length
                && _makerAccounts[_traderParam.makerAccountIndex].owner != address(0),
                _FILE,
                "Invalid maker account owner",
                _index
            );
        } else {
            // The makerAccountOwner and makerAccountNumber is not used if the traderType is not InternalLiquidity
            if (_traderParam.makerAccountIndex == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.makerAccountIndex == 0,
                _FILE,
                "Invalid maker account owner",
                _index
            );
        }
    }

    function validateTransferParams(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        IGenericTraderProxyV2.TransferCollateralParam memory _param,
        uint256 _tradeAccountNumber
    ) public pure {
        if (_param.transferAmounts.length != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _param.transferAmounts.length != 0,
            _FILE,
            "Invalid transfer amounts length"
        );
        if (_param.fromAccountNumber != _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _param.fromAccountNumber != _param.toAccountNumber,
            _FILE,
            "Cannot transfer to same account"
        );
        if (_tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber,
            _FILE,
            "Invalid trade account number"
        );
        _cache.otherAccountNumber = _tradeAccountNumber == _param.toAccountNumber
            ? _param.fromAccountNumber
            : _param.toAccountNumber;

        uint256 length = _param.transferAmounts.length;
        for (uint256 i; i < length; ++i) {
            if (_param.transferAmounts[i].amountWei != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _param.transferAmounts[i].amountWei != 0,
                _FILE,
                "Invalid transfer amount at index",
                i
            );
        }
    }

    function isIsolationModeMarket(IDolomiteMargin _dolomiteMargin, uint256 _marketId) public view returns (bool) {
        return isIsolationModeAsset(_dolomiteMargin.getMarketTokenAddress(_marketId));
    }

    function logBeforeZapEvents(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo memory _tradeAccount,
        IGenericTraderProxyV2.EventEmissionType _eventType
    ) public {
        if (_eventType == IGenericTraderProxyV2.EventEmissionType.BorrowPosition) {
            _cache.eventEmitterRegistry.emitBorrowPositionOpen(
                _tradeAccount.owner,
                _tradeAccount.number
            );
        }
    }

    function logAfterZapEvents(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        IGenericTraderBase.TraderParam[] memory _tradersPath,
        IGenericTraderProxyV2.TransferCollateralParam memory _transferParam,
        IGenericTraderProxyV2.EventEmissionType _eventType
    ) public {
        _cache.eventEmitterRegistry.emitZapExecuted(
            _tradeAccount.owner,
            _tradeAccount.number,
            _marketIdsPath,
            _tradersPath
        );

        if (_eventType == IGenericTraderProxyV2.EventEmissionType.MarginPosition) {
            _logMarginPositionEvent(
                _cache,
                _tradeAccount,
                _marketIdsPath,
                _transferParam
            );
        }
    }

    // ============ Internal Functions ============

    function isIsolationModeAsset(address _token) public view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _token,
            IERC20Metadata(address(0)).name.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }

        string memory name = abi.decode(returnData, (string));
        if (keccak256(bytes(name)) == DOLOMITE_FS_GLP_HASH) {
            return true;
        }
        return _startsWith(DOLOMITE_ISOLATION_PREFIX, name);
    }

    function _startsWith(string memory _start, string memory _str) internal pure returns (bool) {
        if (bytes(_start).length > bytes(_str).length) {
            return false;
        }

        bytes32 hash;
        assembly {
            let size := mload(_start)
            hash := keccak256(add(_str, 32), size)
        }
        return hash == keccak256(bytes(_start));
    }

    function _isWrapperTraderType(
        IGenericTraderBase.TraderType _traderType
    )
        internal
        pure
        returns (bool)
    {
        return IGenericTraderBase.TraderType.IsolationModeWrapper == _traderType;
    }

    function _isUnwrapperTraderType(
        IGenericTraderBase.TraderType _traderType
    )
        internal
        pure
        returns (bool)
    {
        return IGenericTraderBase.TraderType.IsolationModeUnwrapper == _traderType;
    }

    function _logMarginPositionEvent(
        IGenericTraderBase.GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        IGenericTraderProxyV2.TransferCollateralParam memory _param
    ) internal {
        IEventEmitterRegistry.BalanceUpdate memory inputBalanceUpdate;
        // solium-disable indentation
        {
            IDolomiteStructs.Wei memory inputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _inputToken = */ _marketIdsPath[0]
            );
            inputBalanceUpdate = IEventEmitterRegistry.BalanceUpdate({
                deltaWei: inputBalanceWeiAfter.sub(_cache.inputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[0])
            });
        }
        // solium-enable indentation

        IEventEmitterRegistry.BalanceUpdate memory outputBalanceUpdate;
        // solium-disable indentation
        {
            IDolomiteStructs.Wei memory outputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _outputToken = */ _marketIdsPath[_marketIdsPath.length - 1]
            );
            outputBalanceUpdate = IEventEmitterRegistry.BalanceUpdate({
                deltaWei: outputBalanceWeiAfter.sub(_cache.outputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[_marketIdsPath.length - 1])
            });
        }
        // solium-enable indentation

        IEventEmitterRegistry.BalanceUpdate memory marginBalanceUpdate;
        // solium-disable indentation
        {
            IDolomiteStructs.Wei memory marginBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _transferToken = */_param.transferAmounts[0].marketId
            );
            marginBalanceUpdate = IEventEmitterRegistry.BalanceUpdate({
                deltaWei: marginBalanceWeiAfter.sub(_cache.transferBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(
                    _tradeAccount,
                    _param.transferAmounts[0].marketId
                )
            });
        }
        // solium-enable indentation

        // solhint-disable max-line-length
        if (_cache.isMarginDeposit) {
            _cache.eventEmitterRegistry.emitMarginPositionOpen(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _depositToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        } else {
            _cache.eventEmitterRegistry.emitMarginPositionClose(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _withdrawalToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        }
        // solhint-enable max-line-length
    }
}
