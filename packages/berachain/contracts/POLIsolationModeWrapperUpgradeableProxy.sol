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

import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   POLIsolationModeWrapperUpgradeableProxy
 * @author  Dolomite
 *
 * @notice  Base contract for upgradeable POL wrapper trader contracts
 */
contract POLIsolationModeWrapperUpgradeableProxy is ProxyContractHelpers {
    using Address for address;

    // ============ Constants ============

    bytes32 private constant _FILE = "POLIsolationModeWrapperProxy";

    IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY;

    // ============ Constructor ============

    constructor(
        address _berachainRewardsRegistry,
        bytes memory _initializationCalldata
    ) {
        BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        Address.functionDelegateCall(
            implementation(),
            _initializationCalldata,
            "POLIsolationModeWrapperProxy: Initialization failed"
        );
    }

    // ============ Functions ============

    receive() external payable {
        _callImplementation(implementation());
    }

    // solhint-disable-next-line payable-fallback
    fallback() external payable {
        _callImplementation(implementation());
    }

    function implementation() public view returns (address) {
        return BERACHAIN_REWARDS_REGISTRY.polWrapperTrader();
    }
}
