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

import { IGmxV2Registry } from "./IGmxV2Registry.sol";
import { IIsolationModeTokenVaultV1WithFreezableAndPausable } from "../IIsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { IWETH } from "../../../protocol/interfaces/IWETH.sol";


/**
 * @title   IGmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 */
interface IGmxV2IsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1WithFreezableAndPausable {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event IsDepositSourceWrapperSet(bool _isDepositSourceWrapper);
    event ShouldSkipTransferSet(bool _shouldSkipTransfer);
    event ExecutionFeeSet(uint256 _accountNumber, uint256 _executionFee);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external payable;

    function setIsDepositSourceWrapper(bool _isDepositSourceWrapper) external;

    function setShouldSkipTransfer(bool _shouldSkipTransfer) external;

    function WETH() external view returns (IWETH);

    function isDepositSourceWrapper() external view returns (bool);

    function shouldSkipTransfer() external view returns (bool);

    function registry() external view returns (IGmxV2Registry);

    function getExecutionFeeForAccountNumber(uint256 _accountNumber) external view returns (uint256);
}
