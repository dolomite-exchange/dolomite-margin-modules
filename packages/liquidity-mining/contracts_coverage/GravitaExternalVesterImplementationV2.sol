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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ExternalVesterImplementationV1 } from "./ExternalVesterImplementationV1.sol";
import { IExternalVesterV1 } from "./interfaces/IExternalVesterV1.sol";


/**
 * @title   GravitaExternalVesterImplementationV2
 * @author  Dolomite
 *
 * @notice  An implementation of the IExternalVesterV1 interface that allows users to buy PAIR_TOKEN at a discount if
 *          they vest PAIR_TOKEN and oToken for a certain amount of time.
 */
contract GravitaExternalVesterImplementationV2 is ExternalVesterImplementationV1 {
    using SafeERC20 for IERC20;

    bytes32 private constant _PART_1_SLOT = bytes32(uint256(keccak256("eip1967.proxy.part1")) - 1);
    bytes32 private constant _PART_2_SLOT = bytes32(uint256(keccak256("eip1967.proxy.part2")) - 1);

    address private constant _GRAI = 0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487;
    address private constant _SAFE = 0xa75c21C5BE284122a87A37a76cc6C4DD3E55a1D4;
    address private constant _USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    uint256 private constant _GRAI_AMOUNT = 12326.820482411815546625 ether;

    // ==================================================================
    // ======================= Admin Functions ==========================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        IERC20 _pairToken,
        IERC20 _paymentToken,
        IERC20 _rewardToken
    ) ExternalVesterImplementationV1(
        _dolomiteMargin,
        _dolomiteRegistry,
        _pairToken,
        _paymentToken,
        _rewardToken
    ) {}

    function ownerUpgradeForShutdownPart1() external onlyDolomiteMarginOwner(msg.sender) {
        /*assert(_getUint256(_PART_1_SLOT) == 0);*/
        _setUint256(_PART_1_SLOT, 1);

        IERC20(_GRAI).safeTransfer(_SAFE, _GRAI_AMOUNT);
    }

    function ownerUpgradeForShutdownPart2() external onlyDolomiteMarginOwner(msg.sender) {
        /*assert(_getUint256(_PART_2_SLOT) == 0);*/
        _setUint256(_PART_2_SLOT, 1);

        // Assumes the USDC is already in here
        uint256 balance = PAIR_TOKEN.balanceOf(address(this));
        _depositIntoDolomite(
            address(this),
            83739606014428120693479726400323499703449033428325717469693567927919900459359,
            PAIR_TOKEN,
            PAIR_MARKET_ID,
            balance * 7724.560802275551609804 ether / _GRAI_AMOUNT
        );
        _depositIntoDolomite(
            address(this),
            41151503422338736178515563136745814916286501924411901014410917272325291445221,
            PAIR_TOKEN,
            PAIR_MARKET_ID,
            balance - (balance * 7724.560802275551609804 ether / _GRAI_AMOUNT)
        );
    }

    function owner() public override view returns (address) {
        return DOLOMITE_MARGIN_OWNER();
    }
}
