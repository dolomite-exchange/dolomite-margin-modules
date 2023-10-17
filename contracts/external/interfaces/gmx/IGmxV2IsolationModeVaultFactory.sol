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

    function ownerSetGmxRegistryV2(address _gmxRegistryV2) external;

    function ownerSetExecutionFee(uint256 _executionFee) external;

    function depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    )
    external;

    /**
     * @dev Sets whether or not the vault should use the GmxV2IsolationModeWrapperTraderV2 as the ERC20 transfer
     *      source when the call to `depositIntoVault` occurs. This value is unset once it is consumed by the call
     *      to `depositIntoVault`.
     *
     * @param  _vault                   The vault whose `_isDepositSourceWrapper` value is being set.
     * @param  _isDepositSourceWrapper  Whether or not the vault should use the `GmxV2IsolationModeWrapperTraderV2` as
     *                                  deposit source.
     */
    function setIsDepositSourceWrapper(address _vault, bool _isDepositSourceWrapper) external;

    /**
     * @dev     Sets whether or not the vault should skip the transferFrom call when depositing into Dolomite Margin.
     *          This enables the protocol to not revert if there are no tokens in the vault, since no ERC20 event is
     *          emitted with the underlying tokens. This value is unset after it is consumed in `depositIntoVault`
     *          or `withdrawFromVault`.
     *
     * @param  _vault               The vault whose shouldSkipTransfer value is being set.
     * @param  _shouldSkipTransfer  Whether or not the vault should skip the ERC20 transfer for the underlying token.
     */
    function setShouldSkipTransfer(address _vault, bool _shouldSkipTransfer) external;

    function INDEX_TOKEN() external view returns (address);

    function SHORT_TOKEN() external view returns (address);

    function LONG_TOKEN() external view returns (address);

    function INDEX_TOKEN_MARKET_ID() external view returns (uint256);

    function SHORT_TOKEN_MARKET_ID() external view returns (uint256);

    function LONG_TOKEN_MARKET_ID() external view returns (uint256);

    function gmxRegistryV2() external view returns (IGmxRegistryV2);

    /**
     * @dev     The amount of gas (in ETH) that should be sent with a position so the user can pay the gas fees to be
     *          liquidated. The gas fees are refunded when a position is closed.
     */
    function executionFee() external view returns (uint256);
}
