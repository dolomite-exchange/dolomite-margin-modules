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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IBaseRegistry } from "../interfaces/IBaseRegistry.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { ValidationLib } from "../lib/ValidationLib.sol";


/**
 * @title   BaseRegistry
 * @author  Dolomite
 *
 * @notice  Registry contract for storing ecosystem-related addresses
 */
contract BaseRegistry is
    IBaseRegistry,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{

    // ===================== Constants =====================

    bytes32 private constant _FILE = "BaseRegistry";
    bytes32 private constant _DOLOMITE_REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.dolomiteRegistry")) - 1); // solhint-disable-line max-line-length

    // ===================== Functions =====================

    function ownerSetDolomiteRegistry(
        address _dolomiteRegistry
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    function dolomiteRegistry() external view returns (IDolomiteRegistry) {
        return IDolomiteRegistry(_getAddress(_DOLOMITE_REGISTRY_SLOT));
    }

    // ===================== Internal Functions =====================

    function _ownerSetDolomiteRegistry(
        address _dolomiteRegistry
    ) internal {
        if (_dolomiteRegistry != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteRegistry != address(0),
            _FILE,
            "Invalid dolomiteRegistry"
        );
        bytes memory returnData = ValidationLib.callAndCheckSuccess(
            _dolomiteRegistry,
            IDolomiteRegistry(_dolomiteRegistry).genericTraderProxy.selector,
            bytes("")
        );
        abi.decode(returnData, (address));

        _setAddress(_DOLOMITE_REGISTRY_SLOT, _dolomiteRegistry);
        emit DolomiteRegistrySet(_dolomiteRegistry);
    }
}
