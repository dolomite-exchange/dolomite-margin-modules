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


/**
 * @title   IPendleSyToken
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Pendle's standard yield tokens (SYs).
 */
interface IPendleSyToken is IERC20 {

    function pause() external;

    function transferOwnership(
        address newOwner,
        bool direct,
        bool renounce
    ) external;

    function deposit(
        address receiver,
        address tokenIn,
        uint256 amountTokenToDeposit,
        uint256 minSharesOut
    ) external payable returns (uint256 amountSharesOut);

    function paused() external view returns (bool);

    function owner() external view returns (address);

    function getTokensIn() external view returns (address[] memory);

    function yieldToken() external view returns (address);
}
