// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBGTIsolationModeTokenVaultV1 } from "./interfaces/IBGTIsolationModeTokenVaultV1.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   BGTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the BGT token
 *          that can be used to credit a user's Dolomite balance. BGT held in the vault is considered to be in isolation
 *          mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held
 *          in the same position as other "isolated" tokens.
 */
contract BGTIsolationModeTokenVaultV1 is
    IsolationModeTokenVaultV1,
    IBGTIsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BGTIsolationModeTokenVaultV1";
    bytes32 private constant _IS_DEPOSIT_SOURCE_METAVAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceMetaVault")) - 1); // solhint-disable-line max-line-length

    function setIsDepositSourceMetaVault(
        bool _isDepositSourceMetaVault
    ) external {
        Require.that(
            msg.sender == registry().getVaultToMetaVault(address(this)),
            _FILE,
            "Only metaVault"
        );
        _setIsDepositSourceMetaVault(_isDepositSourceMetaVault);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 /* _amount */
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        assert(_from == OWNER());
        Require.that(
            isDepositSourceMetaVault(),
            _FILE,
            "Only metaVault can deposit"
        );
        _setIsDepositSourceMetaVault(false);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(registry().getAccountToMetaVault(OWNER()));
        assert(_recipient != address(this));
        metaVault.withdrawBGTAndRedeem(_recipient, _amount);
    }

    function isDepositSourceMetaVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_METAVAULT_SLOT) == 1;
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsIsolationModeVaultFactory(VAULT_FACTORY()).berachainRewardsRegistry();
    }

    function dolomiteRegistry()
        public
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _setIsDepositSourceMetaVault(bool _isDepositSourceMetaVault) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_METAVAULT_SLOT, _isDepositSourceMetaVault ? 1 : 0);
        emit IsDepositSourceMetaVaultSet(_isDepositSourceMetaVault);
    }

    function _depositIntoVaultForDolomiteMargin(
        uint256 /* _toAccountNumber */,
        uint256 /* _amountWei */
    ) internal pure override {
        revert('not implemented');
    }
}
