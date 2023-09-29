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

import { IGmxRegistryV2 } from "./IGmxRegistryV2.sol";
import { IFreezableIsolationModeVaultFactory } from "../IFreezableIsolationModeVaultFactory.sol";


/**
 * @title   IGmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeVaultFactory that creates vaults for GM tokens.
 */
interface IGmxV2IsolationModeVaultFactory is IFreezableIsolationModeVaultFactory {

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct MarketInfoConstructorParams {
        address marketToken;
        address indexToken;
        address shortToken;
        address longToken;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event GmxRegistryV2Set(address _gmxRegistryV2);
    event ExecutionFeeSet(uint256 _executionFee);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external;

    function depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _otherMarketId,
        uint256 _amountWei
    )
    external;

    function withdrawFromDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) external;

    function ownerSetGmxRegistryV2(address _gmxRegistryV2) external;

    function ownerSetExecutionFee(uint256 _executionFee) external;

    function setIsDepositSourceWrapper(address _vault, bool _isDepositSourceWrapper) external;

    function setShouldSkipTransfer(address _vault, bool _shouldSkipTransfer) external;

    function clearExpirationIfNeeded(
        address _vault,
        uint256 _accountNumber,
        uint256 _owedMarketId
    )
    external;

    function INDEX_TOKEN() external view returns (address);

    function SHORT_TOKEN() external view returns (address);

    function LONG_TOKEN() external view returns (address);

    function INDEX_TOKEN_MARKET_ID() external view returns (uint256);

    function SHORT_TOKEN_MARKET_ID() external view returns (uint256);

    function LONG_TOKEN_MARKET_ID() external view returns (uint256);

    function gmxRegistryV2() external view returns (IGmxRegistryV2);

    function executionFee() external view returns (uint256);
}
