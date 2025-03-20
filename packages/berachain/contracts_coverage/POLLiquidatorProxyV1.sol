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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
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
    OnlyDolomiteMargin,
    IPOLLiquidatorProxyV1
{

    // ============ Constants ============

    bytes32 private constant _FILE = "POLLiquidatorProxyV1";
    ILiquidatorProxyV5 public immutable LIQUIDATOR_PROXY_V5;

    // ============ Constructor ============

    constructor (
        address _liquidatorProxyV5,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        LIQUIDATOR_PROXY_V5 = ILiquidatorProxyV5(_liquidatorProxyV5);
    }

    // ============ External Functions ============

    function initialize() external initializer {}

    function liquidateProofOfLiquidityCollateral(
        ILiquidatorProxyV5.LiquidateParams memory _liquidateParams
    ) public nonReentrant {
        if (_liquidateParams.solidAccount.owner == msg.sender || DOLOMITE_MARGIN().getIsLocalOperator(_liquidateParams.solidAccount.owner, msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _liquidateParams.solidAccount.owner == msg.sender
                || DOLOMITE_MARGIN().getIsLocalOperator(_liquidateParams.solidAccount.owner, msg.sender),
            _FILE,
            "Sender not operator",
            msg.sender
        );

        IPOLIsolationModeTokenVaultV1(_liquidateParams.liquidAccount.owner).prepareForLiquidation(
            _liquidateParams.liquidAccount.number,
            _liquidateParams.minOutputAmountWei
        );
        LIQUIDATOR_PROXY_V5.liquidateViaProxyWithStrictInputMarket(_liquidateParams);
    }

    function liquidatorProxy() external view returns (address) {
        return address(LIQUIDATOR_PROXY_V5);
    }
}
