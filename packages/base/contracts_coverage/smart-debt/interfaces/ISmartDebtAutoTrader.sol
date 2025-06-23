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

import { IInternalAutoTraderBase } from "./IInternalAutoTraderBase.sol";
import { ISmartDebtSettings } from "./ISmartDebtSettings.sol";


/**
 * @title   ISmartDebtAutoTrader
 * @author  Dolomite
 *
 * Interface for performing internal trades using smart debt
 */
interface ISmartDebtAutoTrader is IInternalAutoTraderBase, ISmartDebtSettings {

    /**
     * Volatility levels for the smart debt auto trader
     */
    enum VolatilityLevel {
        NORMAL,
        SLIGHT,
        DEPEG
    }

    /**
     * Initializes the smart debt auto trader
     *
     * @param _tokens Array of token addresses
     * @param _feedIds Array of Chainlink feed IDs corresponding to provided token addresses
     */
    function initialize(
        address[] memory _tokens,
        bytes32[] memory _feedIds
    ) external;
}
