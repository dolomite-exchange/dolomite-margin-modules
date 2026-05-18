// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2026 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OnlyDolomiteMargin } from "./OnlyDolomiteMargin.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";


/**
 * @title   IsIsolationModeMarket
 * @author  Dolomite
 *
 */
abstract contract IsIsolationModeMarket is OnlyDolomiteMargin {

    // ============ Constants ============

    bytes32 private constant _FILE = "IsIsolationModeMarket";

    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";

    // ============ Internal Functions ============

    function _isIsolationModeMarket(uint256 _marketId) internal view returns (bool) {
        return _isIsolationModeAsset(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));
    }

    function _isIsolationModeAsset(address _token) internal view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _token,
            IERC20Metadata(address(0)).name.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }

        string memory name = abi.decode(returnData, (string));
        if (keccak256(bytes(name)) == DOLOMITE_FS_GLP_HASH) {
            return true;
        }
        return _startsWith(DOLOMITE_ISOLATION_PREFIX, name);
    }

    function _startsWith(string memory _start, string memory _str) internal pure returns (bool) {
        if (bytes(_start).length > bytes(_str).length) {
            return false;
        }

        bytes32 hash;
        assembly {
            let size := mload(_start)
            hash := keccak256(add(_str, 32), size)
        }
        return hash == keccak256(bytes(_start));
    }
}
