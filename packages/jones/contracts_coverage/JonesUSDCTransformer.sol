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

import { IDolomiteTransformer } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteTransformer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IJonesRouter } from "./interfaces/IJonesRouter.sol";



/**
 * @title   JonesUSDCTransformer
 * @author  Dolomite
 *
 * @notice  Transformer contract to enable users to transform their jUSDC into the new jUSDC
 */
contract JonesUSDCTransformer is IDolomiteTransformer {
    using SafeERC20 for IERC20;

    address public immutable inputToken; // old jUSDC
    address public immutable outputToken; // new jUSDC
    IJonesRouter public immutable router;

    constructor(address _oldjUsdc, address _newjUsdc, address _router) {
        inputToken = _oldjUsdc;
        outputToken = _newjUsdc;
        router = IJonesRouter(_router);
    }

    function transform(uint256 amount, bytes calldata /* _extraData */) external returns (uint256) {
        IERC20(inputToken).safeApprove(address(router), amount);
        (uint256 newjUSDC, uint256 compoundAmount) = router.migratePosition();
        return (newjUSDC + compoundAmount);
    }
}
