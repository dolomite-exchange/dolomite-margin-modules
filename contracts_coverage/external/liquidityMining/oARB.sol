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

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

/**
 * @title   oARB
 * @author  Dolomite
 *
 * ERC20 contract for oARB tokens
 */
contract oARB is ERC20, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    bytes32 private constant _FILE = "oARBToken";

    uint256 public marketId;

    modifier requireIsInitialized {
        if (marketId != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(marketId != 0,
            _FILE,
            "Not initialized"
        );
        _;
    }

    constructor(address _dolomiteMargin)
        ERC20("oARB Token", "oARB")
        OnlyDolomiteMargin(_dolomiteMargin) {
        }

    function mint(uint256 _amount) external requireIsInitialized onlyDolomiteMarginGlobalOperator(msg.sender) {
        _mint(msg.sender, _amount);
    }

    function burn(uint256 _amount) external requireIsInitialized onlyDolomiteMarginGlobalOperator(msg.sender) {
        // @todo Withdraw from dolomite margin on behalf of sender
        _burn(msg.sender, _amount);
    }

    function ownerInitialize() external onlyDolomiteMarginOwner(msg.sender) {
        if (marketId == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(marketId == 0,
            _FILE,
            "Already initialized"
        );

        marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(this));
    }
}
