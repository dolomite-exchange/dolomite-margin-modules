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

// solhint-disable max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GmxV2IsolationModeTokenVaultV1 } from "./GmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "./interfaces/IGmxV2IsolationModeVaultFactory.sol";
// solhint-enable max-line-length


/**
 * @title   GmxV2IsolationModeTokenVaultV2
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds any GMX V2 Market token that and
 *          can be used to credit a user's Dolomite balance.
 * @dev     In certain cases, GM tokens may be refunded to the vault owner.
 *          The vault owner MUST be able to handle GM tokens
 */
contract GmxV2IsolationModeTokenVaultV2 is GmxV2IsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV2";

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(address _weth, uint256 _chainId) GmxV2IsolationModeTokenVaultV1(_weth, _chainId) {
        // solhint-disable-line no-empty-blocks
    }

    function handlerSyncVirtualBalance(uint256 _amountWei) external {
        Require.that(
            registry().isHandler(msg.sender),
            _FILE,
            "Invalid handler"
        );

        _setVirtualBalance(_amountWei);
    }

    function handlerManualTransfer(uint256 _amountWei, uint256 _handlerAccountNumber) external {
        Require.that(
            registry().isHandler(msg.sender),
            _FILE,
            "Invalid handler"
        );
        Require.that(
            _amountWei != 0,
            _FILE,
            "Invalid amount"
        );

        address handlerVault = IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).getVaultByAccount(msg.sender);
        Require.that(
            handlerVault != address(0),
            _FILE,
            "Invalid handler vault"
        );
        Require.that(
            IERC20(UNDERLYING_TOKEN()).balanceOf(handlerVault) == 0,
            _FILE,
            "Invalid handler vault state"
        );

        IDolomiteStructs.Wei memory handlerBalance = DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: handlerVault,
                number: _handlerAccountNumber
            }),
            marketId()
        );
        Require.that(
            handlerBalance.sign && handlerBalance.value == _amountWei,
            _FILE,
            "Invalid manual transfer"
        );

        _setVirtualBalance(virtualBalance() - _amountWei);
        IERC20(UNDERLYING_TOKEN()).safeTransfer(handlerVault, _amountWei);
    }
}
