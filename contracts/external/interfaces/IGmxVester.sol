// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   IGmxVester
 * @author  Dolomite
 */
interface IGmxVester is IERC20 {

    /**
     * @notice          Deposits esGMX for vesting into GMX.  msg.sender will also need to pay sGLP tokens.
     * @param _amount   The amount of esGMX to deposit for vesting into GMX.
     */
    function deposit(uint256 _amount) external;

    /**
     * @notice  Withdraws all of msg.sender's tokens from the vault and stops vesting for esGMX into GMX.  msg.sender
     *          will receive GMX, esGMX, and sGLP tokens.
     */
    function withdraw() external;

    /**
     * @notice          Gets the account's sGLP balance, which is paired with esGMX for vesting into GMX.
     * @param _account  The account whose sGLP balance should be retrieved.
     */
    function pairAmounts(address _account) external view returns (uint256);

    /**
     * @notice          Gets the amount of GMX  will be received for the given amount of esGMX.
     */
    function getPairAmount(address _account, uint256 _esAmount) external view returns (uint256);

    function getMaxVestableAmount(address _account) external view returns (uint256);
}
