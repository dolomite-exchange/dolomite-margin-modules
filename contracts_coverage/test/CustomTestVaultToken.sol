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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ICustomTestVaultToken } from "./ICustomTestVaultToken.sol";

/**
 * @title   CustomTestVaultToken
 * @author  Dolomite
 *
 * @notice  Contract creating ERC4626 for testing.
 */
contract CustomTestVaultToken is ERC20, ICustomTestVaultToken {

    address immutable public asset;
    uint8 immutable private _decimals;

    constructor(
        address asset_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        asset = asset_;
        _decimals = decimals_;
    }

    function addBalance(address _receiver, uint256 _amount) external {
        _mint(_receiver, _amount);
    }

    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }

    function totalAssets() external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

}
