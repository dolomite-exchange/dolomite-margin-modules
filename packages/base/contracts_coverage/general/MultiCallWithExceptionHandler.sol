// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";


/**
 * @title   MultiCallWithExceptionHandler
 * @author  Michael Elliot <mike@makerdao.com>
 * @author  Joshua Levine <joshua@makerdao.com>
 * @author  Nick Johnson <arachnid@notdot.net>
 * @author  Corey Caplan <corey@dolomite.io>
 *
 * @notice  Aggregate results from multiple read-only function calls
 */
contract MultiCallWithExceptionHandler {
    using Strings for address;

    struct Call {
        address target;
        bytes callData;
    }

    struct CallResult {
        bool success;
        /// If `success` is false, returns an error string
        bytes returnData;
    }

    function aggregate(Call[] memory calls) public returns (uint256 blockNumber, CallResult[] memory returnData) {
        blockNumber = block.number;
        returnData = new CallResult[](calls.length);
        for (uint256 i; i < calls.length; ++i) {
            // solium-disable-next-line security/no-low-level-calls
            (bool success, bytes memory result) = calls[i].target.call(calls[i].callData);
            if (!success) {
                if (result.length < 68) {
                    string memory targetString = calls[i].target.toHexString();
                    result = abi.encodePacked("Multicall::aggregate: revert at <", targetString, ">");
                } else {
                    // solium-disable-next-line security/no-inline-assembly
                    assembly {
                        result := add(result, 0x04)
                    }
                    result = abi.encodePacked(
                        "Multicall::aggregate: revert at <",
                        calls[i].target.toHexString(),
                        "> with reason: ",
                        abi.decode(result, (string))
                    );
                }
            }
            returnData[i] = CallResult({
                success: success,
                returnData: result
            });
        }
    }

    // Helper functions
    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }

    function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
        blockHash = blockhash(blockNumber);
    }

    function getLastBlockHash() public view returns (bytes32 blockHash) {
        blockHash = blockhash(block.number - 1);
    }

    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    function getCurrentBlockDifficulty() public view returns (uint256 difficulty) {
        difficulty = block.difficulty;
    }

    function getCurrentBlockGasLimit() public view returns (uint256 gaslimit) {
        gaslimit = block.gaslimit;
    }

    function getCurrentBlockCoinbase() public view returns (address coinbase) {
        coinbase = block.coinbase;
    }
}
