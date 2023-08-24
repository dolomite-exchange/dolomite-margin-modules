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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDepositCallbackReceiver } from "../interfaces/gmx/IDepositCallbackReceiver.sol";
import { Deposit } from "../interfaces/gmx/Deposit.sol";
import { EventUtils } from "../interfaces/gmx/EventUtils.sol";

import { IWithdrawalCallbackReceiver } from "../interfaces/gmx/IWithdrawalCallbackReceiver.sol";
import { Withdrawal } from "../interfaces/gmx/Withdrawal.sol";

import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IGmxRegistryV2 } from "./GmxRegistryV2.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";

import "hardhat/console.sol";

/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the 
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is IsolationModeTokenVaultV1, IDepositCallbackReceiver, IWithdrawalCallbackReceiver {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";

    // =================================================
    // ================ Field Variables ================
    // =================================================

    bool private _vaultFrozen;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireNotFrozen() {
        Require.that(
            !_vaultFrozen,
            _FILE,
            "Vault is frozen"
        );
        _;
    }
    
    modifier onlyDepositHandler(address _from) {
        Require.that(
            _from == address(registry().gmxDepositHandler()),
            _FILE,
            "Only deposit handler can call",
            _from
        );
        _;
    }

    modifier onlyWithdrawalHandler(address _from) {
        Require.that(
            _from == address(registry().gmxWithdrawalHandler()),
            _FILE,
            "Only withdrawal handler can call",
            _from
        );
        _;
    }
    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function initiateWrapping(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    ) external nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        // freeze vault
        _setVaultFrozenStatus(true);

        _swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyDepositHandler(msg.sender) {
        // adjust virtual GM token amount based on actual amount returned

        // unfreeze vault
        _setVaultFrozenStatus(false);
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyDepositHandler(msg.sender) {
        // burn the virtual GM tokens that were intially set

        // unfreeze vault
        _setVaultFrozenStatus(false);
    }

    function initiateUnwrapping() external nonReentrant onlyVaultOwner(msg.sender) requireNotFrozen() {
        _setVaultFrozenStatus(true);

    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyWithdrawalHandler(msg.sender) {

        _setVaultFrozenStatus(false);
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyWithdrawalHandler(msg.sender) {

        _setVaultFrozenStatus(false);
    }

    function registry() public view returns (IGmxRegistryV2) {
        return IGmxV2IsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistryV2();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        // If this is normal deposit, do transferFrom
        // @note Could also do this in reverse with wrapper address
        if (_from == _proxySelf().owner()) {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }
        else {
            console.log("hold off on transfer");
        }
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _setVaultFrozenStatus(bool _vaultFrozenStatus) internal {
        _vaultFrozen = _vaultFrozenStatus;
    }
}