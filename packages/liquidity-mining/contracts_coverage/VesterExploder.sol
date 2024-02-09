// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2023 Dolomite.

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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IVesterExploder } from "./interfaces/IVesterExploder.sol";
import { IVesterV1 } from "./interfaces/IVesterV1.sol";

/**
 * @title   VesterExploder
 * @author  Dolomite
 *
 */
contract VesterExploder is IVesterExploder, OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VesterExploder";

    // ===================================================
    // ===================== Storage =====================
    // ===================================================

    IVesterV1 public immutable VESTER; // solhint-disable-line var-name-mixedcase
    mapping(address => bool) private _handlerMap;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireOnlyHandler(address _from) {
        if (isHandler(_from)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isHandler(_from),
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    // ===================================================
    // =================== Constructor ===================
    // ===================================================

    constructor(
        address _vester,
        address _dolomiteMargin,
        address[] memory _initialHandlers
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        VESTER = IVesterV1(_vester);

        uint256 len = _initialHandlers.length;
        for (uint256 i; i < len; ++i) {
            _ownerSetIsHandler(_initialHandlers[i], true);
        }
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetIsHandler(address _handler, bool _isHandler) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIsHandler(_handler, _isHandler);
    }

    function explodePosition(uint256 _id) external requireOnlyHandler(msg.sender) {
        VESTER.forceClosePosition(_id);
    }

    function isHandler(address _handler) public view returns (bool) {
        return _handlerMap[_handler];
    }

    // ===================================================
    // =============== Internal Functions ================
    // ===================================================

    function _ownerSetIsHandler(address _handler, bool _isHandler) internal {
        _handlerMap[_handler] = _isHandler;
        emit HandlerSet(_handler, _isHandler);
    }
}
