/*

    Copyright 2022 Dolomite.

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

import { OnlyDolomiteMarginForUpgradeable } from "./OnlyDolomiteMarginForUpgradeable.sol";
import { IAuthorizationBase } from "../interfaces/IAuthorizationBase.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   AuthorizationBase
 * @author  Dolomite
 *
 */
contract AuthorizationBase is IAuthorizationBase, OnlyDolomiteMarginForUpgradeable {

    // ============ Constants ============

    bytes32 private constant _FILE = "AuthorizationBase";

    // ============ State Variables ============

    mapping(address => bool) private _isCallerAuthorized;

    // ============ Modifiers ============

    modifier requireIsCallerAuthorized(address _caller) {
        Require.that(
            _isCallerAuthorized[_caller],
            _FILE,
            "unauthorized",
            _caller
        );
        _;
    }

    // ============ Constructor ============

    constructor(address _dolomiteMargin) {
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    function setIsCallerAuthorized(address _caller, bool _isAuthorized) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            DOLOMITE_MARGIN().getIsGlobalOperator(msg.sender) || DOLOMITE_MARGIN().owner() == msg.sender,
            _FILE,
            "unauthorized",
            _caller
        );
        _isCallerAuthorized[_caller] = _isAuthorized;
    }

    function isCallerAuthorized(address _caller) external view returns (bool) {
        return _isCallerAuthorized[_caller];
    }
}