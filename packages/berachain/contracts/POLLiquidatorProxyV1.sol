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
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IPOLIsolationModeTokenVaultV1 } from "./interfaces/IPOLIsolationModeTokenVaultV1.sol";
import { IPOLLiquidatorProxyV1 } from "./interfaces/IPOLLiquidatorProxyV1.sol";


/**
 * @title   POLLiquidatorProxyV1
 * @author  Dolomite
 *
 * Contract for liquidating POL accounts in DolomiteMargin
 */
contract POLLiquidatorProxyV1 is
    ReentrancyGuard,
    Initializable,
    IPOLLiquidatorProxyV1
{

    // ============ Constants ============

    bytes32 private constant _FILE = "POLLiquidatorProxyV1";
    ILiquidatorProxyV5 public immutable LIQUIDATOR_PROXY_V5;

    // ============ Constructor ============

    constructor (
        address _liquidatorProxyV5
    ) {
        LIQUIDATOR_PROXY_V5 = ILiquidatorProxyV5(_liquidatorProxyV5);
    }

    // ============ External Functions ============

    function initialize() external initializer {}

    function liquidatePOL(
        ILiquidatorProxyV5.LiquidateParams memory _liquidateParams
    ) public nonReentrant {
        IPOLIsolationModeTokenVaultV1(_liquidateParams.liquidAccount.owner).prepareForLiquidation(
            _liquidateParams.liquidAccount.number,
            _liquidateParams.minOutputAmountWei
        );
        LIQUIDATOR_PROXY_V5.liquidate(_liquidateParams);
    }
}
