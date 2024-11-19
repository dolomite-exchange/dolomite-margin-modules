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
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredBGTIsolationModeTokenVaultV1 } from "./interfaces/IInfraredBGTIsolationModeTokenVaultV1.sol";
import { IInfraredBGTStakingPool } from "./interfaces/IInfraredBGTStakingPool.sol";


/**
 * @title   InfraredBGTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the iBGT token
 *          that can be used to credit a user's Dolomite balance. BGT held in the vault is considered to be in isolation
 *          mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held
 *          in the same position as other "isolated" tokens.
 */
contract InfraredBGTIsolationModeTokenVaultV1 is
    IsolationModeTokenVaultV1,
    IInfraredBGTIsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "InfraredBGTUserVaultV1";
    bytes32 private constant _IS_DEPOSIT_SOURCE_METAVAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceMetavault")) - 1); // solhint-disable-line max-line-length

    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 public constant MAX_NUM_REWARD_TOKENS = 10;

    function setIsDepositSourceMetavault(
        bool _isDepositSourceMetavault
    ) external {
        Require.that(
            msg.sender == registry().getVaultToMetavault(address(this)),
            _FILE,
            "Only metavault"
        );
        _setIsDepositSourceMetavault(_isDepositSourceMetavault);
    }

    function stake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _stake(_amount);
    }

    function unstake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _unstake(_amount);
    }

    function getReward() external onlyVaultOwner(msg.sender) {
        _getReward();
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        if (isDepositSourceMetavault()) {
            address metavault = registry().getVaultToMetavault(address(this));
            assert(metavault != address(0));

            _setIsDepositSourceMetavault(false);
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(metavault, address(this), _amount);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }

        _stake(_amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        uint256 unstakedBalance = super.underlyingBalanceOf();
        if (unstakedBalance < _amount) {
            _unstake(_amount - unstakedBalance);
        }

        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function isDepositSourceMetavault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_METAVAULT_SLOT) == 1;
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsIsolationModeVaultFactory(VAULT_FACTORY()).berachainRewardsRegistry();
    }

    function dolomiteRegistry()
        public
        override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function _setIsDepositSourceMetavault(bool _isDepositSourceMetavault) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_METAVAULT_SLOT, _isDepositSourceMetavault ? 1 : 0);
        emit IsDepositSourceMetavaultSet(_isDepositSourceMetavault);
    }

    function _stake(uint256 _amount) internal {
        IInfraredBGTStakingPool pool = registry().iBgtStakingPool();
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(pool), _amount);
        pool.stake(_amount);
    }

    function _unstake(uint256 _amount) internal {
        IInfraredBGTStakingPool pool = registry().iBgtStakingPool();
        pool.withdraw(_amount);
    }

    function _getReward() internal {
        IInfraredBGTStakingPool pool = registry().iBgtStakingPool();
        pool.getReward();

        address[] memory rewardTokens = getRewardTokens();
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 bal = IERC20(rewardTokens[i]).balanceOf(address(this));
            if (bal > 0) {
                try DOLOMITE_MARGIN().getMarketIdByTokenAddress(rewardTokens[i]) returns (uint256 marketId) {
                    IERC20(rewardTokens[i]).approve(address(DOLOMITE_MARGIN()), bal);
                    IIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                        DEFAULT_ACCOUNT_NUMBER,
                        marketId,
                        bal
                    );
                } catch {
                    IERC20(rewardTokens[i]).safeTransfer(OWNER(), bal);
                }
            }
        }
    }

    function getRewardTokens() public view returns (address[] memory tokens) {
        IInfraredBGTStakingPool pool = registry().iBgtStakingPool();
        address[] memory _tokens = new address[](MAX_NUM_REWARD_TOKENS);

        uint256 len;
        for (uint256 i = 0; i < MAX_NUM_REWARD_TOKENS; i++) {
            try pool.rewardTokens(i) returns (address token) {
                _tokens[i] = token;
            } catch {
                break;
            }
            len++;
        }

        // make it pretty for return
        tokens = new address[](len);
        for (uint256 j = 0; j < len; j++) {
            tokens[j] = _tokens[j];
        }
    }
}
