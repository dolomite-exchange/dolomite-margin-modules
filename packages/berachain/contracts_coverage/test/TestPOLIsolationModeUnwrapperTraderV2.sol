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

import { POLIsolationModeUnwrapperTraderV2 } from "../POLIsolationModeUnwrapperTraderV2.sol";

/**
 * @title   TestPOLIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping unwrapping POL tokens into normal markets. Upon settlement,
 *          the burned dToken is sent from the user's vault to this contract and the factory
 *          token is burned from `DolomiteMargin`.
 */
contract TestPOLIsolationModeUnwrapperTraderV2 is
    POLIsolationModeUnwrapperTraderV2
{

    // ============ Constants ============

    bytes32 private constant _FILE = "TestPOLIsolationModeUnwrapperV2";

    bytes32 private constant _INPUT_AMOUNT_PAR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputAmountPar")) - 1);
    bytes32 private constant _LIQUIDATION_ADDRESS_OVERRIDE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.liquidationAddressOverride")) - 1); // solhint-disable-line max-line-length

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(
        address _berachainRewardsRegistry,
        address _dolomiteMargin
    )
    POLIsolationModeUnwrapperTraderV2(
        _berachainRewardsRegistry,
        _dolomiteMargin
    ) {
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function getInputAmountParInternalTrade() public view returns (uint256) {
        return _getInputAmountParInternalTrade();
    }

    function getVaultForInternalTrade() public view returns (address) {
        return _getVaultForInternalTrade();
    }

    function validateInputAndOutputMarketId(uint256 _inputMarketId, uint256 _outputMarketId) public view {
        _validateInputAndOutputMarketId(_inputMarketId, _outputMarketId);
    }

    function validateInputAndOutputToken(address _inputToken, address _outputToken) public view {
        _validateInputAndOutputToken(_inputToken, _outputToken);
    }
}
