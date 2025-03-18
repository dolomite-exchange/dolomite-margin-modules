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

import { ILiquidatorProxyV5 } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/ILiquidatorProxyV5.sol"; // solhint-disable-line max-line-length


/**
 * @title   IPOLLiquidatorProxyV1
 * @author  Dolomite
 *
 * Interface for liquidating POL accounts in DolomiteMargin. This mainly exists because moving funds from the POL reward
 * vault to the meta vault involves a DolomiteMargin operation. Since we cannot recursively invoke operations, we must
 * first do the unstake operation (via prepare for liquidation), then do the liquidation. It's expected this contract
 * does minimal validation. Instead, validation is done on the contracts being invoked
 */
interface IPOLLiquidatorProxyV1 {

    // ============ Enums ============

    function initialize() external;

    function liquidate(
        ILiquidatorProxyV5.LiquidateParams memory _liquidateParams
    ) external;
}
