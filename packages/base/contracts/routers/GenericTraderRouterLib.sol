// /*

//     Copyright 2023 Dolomite.

//     Licensed under the Apache License, Version 2.0 (the "License");
//     you may not use this file except in compliance with the License.
//     You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

//     Unless required by applicable law or agreed to in writing, software
//     distributed under the License is distributed on an "AS IS" BASIS,
//     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//     See the License for the specific language governing permissions and
//     limitations under the License.

// */

// pragma solidity ^0.8.9;

// import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
// import { TypesLib } from "../protocol/lib/TypesLib.sol";
// import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";

// import { AccountActionLib } from "../lib/AccountActionLib.sol";
// import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
// import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
// import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";



// /**
//  * @title   GenericTraderProxyV1Lib
//  * @author  Dolomite
//  *
//  * @dev Library contract for reducing code size of the GenericTraderProxyV1 contract
//  */
// library GenericTraderProxyV1Lib {
//     using TypesLib for IDolomiteStructs.Wei;

//     // ============ Internal Functions ============

//     function logBeforeZapEvents(
//         IGenericTraderBase.GenericTraderProxyCache memory _cache,
//         IDolomiteStructs.AccountInfo memory _tradeAccount,
//         IGenericTraderProxyV1.EventEmissionType _eventType
//     ) public {
//         if (_eventType == IGenericTraderProxyV1.EventEmissionType.BorrowPosition) {
//             _cache.eventEmitterRegistry.emitBorrowPositionOpen(
//                 _tradeAccount.owner,
//                 _tradeAccount.number
//             );
//         }
//     }

//     function logAfterZapEvents(
//         IGenericTraderBase.GenericTraderProxyCache memory _cache,
//         IDolomiteStructs.AccountInfo memory _tradeAccount,
//         uint256[] memory _marketIdsPath,
//         IGenericTraderBase.TraderParam[] memory _tradersPath,
//         IGenericTraderProxyV1.TransferCollateralParam memory _transferParam,
//         IGenericTraderProxyV1.EventEmissionType _eventType
//     ) public {
//         _cache.eventEmitterRegistry.emitZapExecuted(
//             _tradeAccount.owner,
//             _tradeAccount.number,
//             _marketIdsPath,
//             _tradersPath
//         );

//         if (_eventType == IGenericTraderProxyV1.EventEmissionType.MarginPosition) {
//             _logMarginPositionEvent(
//                 _cache,
//                 _tradeAccount,
//                 _marketIdsPath,
//                 _transferParam
//             );
//         }
//     }

//     function _logMarginPositionEvent(
//         IGenericTraderBase.GenericTraderProxyCache memory _cache,
//         IDolomiteStructs.AccountInfo memory _tradeAccount,
//         uint256[] memory _marketIdsPath,
//         IGenericTraderProxyV1.TransferCollateralParam memory _param
//     ) internal {
//         Events.BalanceUpdate memory inputBalanceUpdate;
//         // solium-disable indentation
//         {
//             Types.Wei memory inputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
//                 _tradeAccount,
//                 /* _inputToken = */ _marketIdsPath[0]
//             );
//             inputBalanceUpdate = Events.BalanceUpdate({
//                 deltaWei: inputBalanceWeiAfter.sub(_cache.inputBalanceWeiBeforeOperate),
//                 newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[0])
//             });
//         }
//         // solium-enable indentation

//         Events.BalanceUpdate memory outputBalanceUpdate;
//         // solium-disable indentation
//         {
//             Types.Wei memory outputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
//                 _tradeAccount,
//                 /* _outputToken = */ _marketIdsPath[_marketIdsPath.length - 1]
//             );
//             outputBalanceUpdate = Events.BalanceUpdate({
//                 deltaWei: outputBalanceWeiAfter.sub(_cache.outputBalanceWeiBeforeOperate),
//                 newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[_marketIdsPath.length - 1])
//             });
//         }
//         // solium-enable indentation

//         Events.BalanceUpdate memory marginBalanceUpdate;
//         // solium-disable indentation
//         {
//             Types.Wei memory marginBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
//                 _tradeAccount,
//                 /* _transferToken = */_param.transferAmounts[0].marketId
//             );
//             marginBalanceUpdate = Events.BalanceUpdate({
//                 deltaWei: marginBalanceWeiAfter.sub(_cache.transferBalanceWeiBeforeOperate),
//                 newPar: _cache.dolomiteMargin.getAccountPar(
//                     _tradeAccount,
//                     _param.transferAmounts[0].marketId
//                 )
//             });
//         }
//         // solium-enable indentation

//         if (_cache.isMarginDeposit) {
//             _cache.eventEmitterRegistry.emitMarginPositionOpen(
//                 _tradeAccount.owner,
//                 _tradeAccount.number,
//                 /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
//                 /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
//                 /* _depositToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
//                 inputBalanceUpdate,
//                 outputBalanceUpdate,
//                 marginBalanceUpdate
//             );
//         } else {
//             _cache.eventEmitterRegistry.emitMarginPositionClose(
//                 _tradeAccount.owner,
//                 _tradeAccount.number,
//                 /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
//                 /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
//                 /* _withdrawalToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
//                 inputBalanceUpdate,
//                 outputBalanceUpdate,
//                 marginBalanceUpdate
//             );
//         }
//     }
// }