// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IGenericTraderBase } from "../../interfaces/IGenericTraderBase.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   ILiquidatorProxyV5
 * @author  Dolomite
 *
 * Interface for liquidating positions via the LiquidatorProxyV5
 */
interface ILiquidatorProxyV5 {

    // ============ Enums ============

    struct LiquidateParams {
        IDolomiteStructs.AccountInfo solidAccount;
        IDolomiteStructs.AccountInfo liquidAccount;
        uint256[] marketIdsPath;
        /// @dev Can be -1 to denote selling all of the user's received collateral
        uint256 inputAmountWei;
        /// @dev Can be -1 to denote liquidating the entire position
        uint256 minOutputAmountWei;
        IGenericTraderBase.TraderParam[] tradersPath;
        IDolomiteStructs.AccountInfo[] makerAccounts;
        uint256 expirationTimestamp;
        bool withdrawAllReward;
    }

    function initialize() external;

    /**
     * Same as `liquidate` but only callable by a global operator. The `_validateAssetForLiquidation` checks are
     * performed on the `msg.sender` since it's presumed to be the valid liquidator. Only the input market has a strict
     * check performed
     */
    function liquidateViaProxyWithStrictInputMarket(LiquidateParams memory _liquidateParams) external;

    function liquidate(LiquidateParams memory _liquidateParams) external;
}
