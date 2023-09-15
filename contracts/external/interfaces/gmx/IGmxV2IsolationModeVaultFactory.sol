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
import { IIsolationModeVaultFactory } from "../IIsolationModeVaultFactory.sol";


/**
 * @title   IGmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeVaultFactory that creates vaults for GM tokens.
 */
interface IGmxV2IsolationModeVaultFactory is IIsolationModeVaultFactory {

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct TokenAndMarketAddresses {
        address marketToken;
        address indexToken;
        address shortToken;
        address longToken;
    }

    struct TokenAndMarketParams {
        address marketToken;
        address indexToken;
        uint256 indexTokenMarketId;
        address shortToken;
        uint256 shortTokenMarketId;
        address longToken;
        uint256 longTokenMarketId;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event GmxRegistryV2Set(address _gmxRegistryV2);

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

    function setIsVaultFrozen(address _vault, bool _isVaultFrozen) external;

    function setIsDepositSourceWrapper(address _vault, bool _isDepositSourceWrapper) external;

    function setShouldSkipTransfer(address _vault, bool _shouldSkipTransfer) external;

    function SHORT_TOKEN() external view returns (address);

    function LONG_TOKEN() external view returns (address);

    function gmxRegistryV2() external view returns (IGmxRegistryV2);

    function getMarketInfo() external view returns (TokenAndMarketParams memory);
}
