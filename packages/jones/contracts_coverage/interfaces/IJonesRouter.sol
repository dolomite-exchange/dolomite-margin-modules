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
 * @title   IJonesRouter
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's Router contract (0x4bC4D296DfCe661F34DD72D642d2A7C348E22A04)
 */
interface IJonesRouter {

    function upgradeToAndCall(address, bytes calldata) external payable;

    function migratePosition() external returns (uint256, uint256);

    function initialize(
        address _routerV1,
        address _trackerV1,
        address _controllerV1,
        address _whitelistController,
        address _underlyingVault,
        address _incentiveReceiver,
        uint256 _compoundUVRT,
        uint256 _unCompoundUVRT,
        uint256 _jusdc
    ) external;
}
