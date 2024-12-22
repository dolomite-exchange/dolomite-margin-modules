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

import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
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

    // ============ Internal Functions ============

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
