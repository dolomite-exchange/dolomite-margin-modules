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


/**
 * @title   IChainlinkAutomation
 * @author  Dolomite
 *
 * @dev     Chainlink Automation enables conditional execution of your smart contracts functions through a
 *          hyper-reliable and decentralized automation platform that uses the same external network of node operators
 *          that secures billions in value. The documentation is copied from Chainlink's official documentation.
 */
interface IChainlinkAutomation {

    /**
     * @notice  The  method that is simulated by keepers to see if any work actually needs to be performed. This method
     *          does does not actually need to be executable, and since it is only ever simulated it can consume a lot
     *          of gas.
     * @dev     To ensure that it is never called, you may want to add the `cannotExecute` modifier from `KeeperBase` to
     *          your implementation of this method.
     * @param   _checkData      specified in the upkeep registration so it is always the same for a registered upkeep.
     *                          This can easily be broken down into specific arguments using `abi.decode`, so multiple
     *                          up-keeps can be registered on the  same contract and easily differentiated by the
     *                          contract.
     * @return  upkeepNeeded    A boolean to indicate whether the keeper should call `performUpkeep` or not.
     * @return  performData    The bytes that the keeper should call `performUpkeep` with, if upkeep is needed. If you
     *                          would like to encode data to decode later, try `abi.encode`.
     */
    function checkUpkeep(bytes calldata _checkData) external returns (bool upkeepNeeded, bytes memory performData);

    /**
     * @notice  The method that is actually executed by the keepers, via the registry. The data returned by the
     *          `checkUpkeep` simulation will be passed into this method to actually be executed.
     * @dev     The input to this method should not be trusted, and the caller of the method should not even be
     *          restricted to any single registry. Anyone should be able call it, and the input should be validated,
     *          there is no guarantee that the data passed in is the _performData returned from checkUpkeep. This could
     *          happen due to malicious keepers, racing keepers, or simply a state change while the `performUpkeep`
     *          transaction is waiting for confirmation. Always validate the data passed in.
     * @param   _performData    The data which was passed back from the `_checkData` simulation. If it is encoded, it
     *                          can easily be decoded into other types by calling `abi.decode`. This data should not be
     *                          trusted, and should be validated against the contract's current state.
     */
    function performUpkeep(bytes calldata _performData) external;
}
