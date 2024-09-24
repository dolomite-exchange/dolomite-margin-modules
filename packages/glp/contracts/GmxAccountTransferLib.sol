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

import { AccountTransferReceiver } from "./AccountTransferReceiver.sol";


/**
 * @title   GmxAccountTransferLib
 * @author  Dolomite
 *
 * @notice  A library contract that contains helper functions to perform GMX account transfers out
 */
library GmxAccountTransferLib {

    // ===========================================================
    // ======================== Constants ========================
    // ===========================================================

    bytes32 private constant _FILE = "GmxAccountTransferLib";

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant PRICE_PRECISION = 10 ** 30;

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    function createAccountTransferReceiver(
        address _tokenVault,
        address _vaultOwner,
        address _gmxRegistry
    ) public returns (address) {
        bytes32 salt = keccak256(abi.encode(_vaultOwner));
        AccountTransferReceiver receiver = new AccountTransferReceiver{ salt: salt }(
            _tokenVault,
            _vaultOwner,
            _gmxRegistry
        );
        return address(receiver);
    }

    function getAccountTransferOutReceiverAddress(
        address _tokenVault,
        address _vaultOwner,
        address _gmxRegistry
    ) public pure returns (address) {
        bytes32 salt = keccak256(abi.encode(_vaultOwner));
        bytes32 deploymentHash = keccak256(abi.encodePacked(
            bytes1(0xff),
            _tokenVault, // @follow-up Could use address(this) instead, but they should be equal since delegatecall
            salt,
            keccak256(abi.encodePacked(
                type(AccountTransferReceiver).creationCode,
                abi.encode(
                    _tokenVault,
                    _vaultOwner,
                    _gmxRegistry
                )
            ))
        ));
        return address(uint160(uint256(deploymentHash)));
    }
}
