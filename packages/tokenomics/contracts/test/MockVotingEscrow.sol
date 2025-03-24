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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @title   MockVotingEscrow
 * @author  Dolomite
 *
 * @notice  Mock voting escrow
 */
contract MockVotingEscrow {

    IERC20 immutable public DOLO;

    constructor(address _dolo) {
        DOLO = IERC20(_dolo);
    }

    function create_lock_for(
        uint256 _amount,
        uint256 /* _lockDuration */,
        address /* _receiver */
    ) external returns (uint256) {
        DOLO.transferFrom(msg.sender, address(this), _amount);
        return _amount;
    }
}
