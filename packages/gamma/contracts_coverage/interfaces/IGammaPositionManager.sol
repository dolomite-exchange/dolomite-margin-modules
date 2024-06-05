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


/**
 * @title   IGammaPositionManager
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on the Gamma PositionManager
 */
interface IGammaPositionManager {

    struct DepositReservesParams {
        /// @dev protocolId of GammaPool (e.g. version of GammaPool)
        uint16 protocolId;
        /// @dev address of CFMM, along with protocolId can be used to calculate GammaPool address
        address cfmm;
        /// @dev receiver of GS LP tokens when depositing
        address to;
        /// @dev timestamp after which the transaction expires. Used to prevent stale transactions from executing
        uint256 deadline;
        /// @dev amounts of reserve tokens caller desires to deposit
        uint256[] amountsDesired;
        /// @dev minimum amounts of reserve tokens expected to have been deposited. Slippage protection
        uint256[] amountsMin;
    }

    struct WithdrawReservesParams {
        /// @dev protocolId of GammaPool (e.g. version of GammaPool)
        uint16 protocolId;
        /// @dev address of CFMM, along with protocolId can be used to calculate GammaPool address
        address cfmm;
        /// @dev receiver of GS LP tokens when depositing
        address to;
        /// @dev amount of GS LP tokens that will be burned in the withdrawal
        uint256 amount;
        /// @dev timestamp after which the transaction expires. Used to prevent stale transactions from executing
        uint256 deadline;
        /// @dev minimum amounts of reserve tokens expected to have been deposited. Slippage protection
        uint256[] amountsMin;
    }


    function depositReserves(
        DepositReservesParams calldata params
    ) external returns (uint256[] memory, uint256);

    function withdrawReserves(
        WithdrawReservesParams calldata params
    ) external returns (uint256[] memory, uint256);
}
