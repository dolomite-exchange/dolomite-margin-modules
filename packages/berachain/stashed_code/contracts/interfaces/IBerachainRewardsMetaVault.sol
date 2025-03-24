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

import { IBaseMetaVault } from "./IBaseMetaVault.sol";


/**
 * @title   IBerachainRewardsMetaVault
 * @author  Dolomite
 *
 */
interface IBerachainRewardsMetaVault is IBaseMetaVault {

    struct BgtValidatorStorageStruct {
        bytes pubkey;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event BgtValidatorSet(bytes validator);
    event BgtmValidatorSet(address validator);

    // ================================================
    // ================== Functions ===================
    // ================================================

    function delegateBGT(address _delegatee) external;

    function queueBGTBoost(bytes memory _validator, uint128 _amount) external;

    function activateBGTBoost(bytes memory _validator) external;

    function cancelBGTBoost(bytes memory _validator, uint128 _amount) external;

    function queueDropBGTBoost(bytes memory _validator, uint128 _amount) external;

    function cancelDropBGTBoost(bytes memory _validator, uint128 _amount) external;

    function dropBGTBoost(bytes memory _validator) external;

    function withdrawBGTAndRedeem(address _recipient, uint256 _amount) external;

    function redeemBGTM(address _recipient, uint256 _amount) external;

    function blocksToActivateBgtBoost() external view returns (uint256);

    function bgtBalanceOf() external view returns (uint256);

    function bgtmBalanceOf() external view returns (uint256);
}
