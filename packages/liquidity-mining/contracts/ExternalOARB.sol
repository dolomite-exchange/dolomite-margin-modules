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

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @title   ExternalOARB
 * @author  Dolomite
 *
 * ERC20 contract for oARB tokens
 */
contract ExternalOARB is ERC20, Ownable {

    // ===================================================
    // ====================== Events =====================
    // ===================================================

    event HandlerSet(address indexed handler, bool isTrusted);

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler() {
        require(_handlersMap[msg.sender], "oARB: Invalid handler");
        _;
    }

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    mapping(address => bool) _handlersMap;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _owner,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        _transferOwnership(_owner);
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function ownerSetHandler(address _handler, bool _isTrusted) external onlyOwner {
        _handlersMap[_handler] = _isTrusted;
        emit HandlerSet(_handler, _isTrusted);
    }

    function ownerMint(uint256 _amount) external onlyOwner {
        _mint(msg.sender, _amount);
    }

    function ownerBurn(uint256 _amount) external onlyOwner {
        _burn(msg.sender, _amount);
    }

    function mint(uint256 _amount) external onlyHandler {
        _mint(msg.sender, _amount);
    }

    function burn(uint256 _amount) external onlyHandler {
        _burn(msg.sender, _amount);
    }

    function isHandler(address _handler) external view returns (bool) {
        return _handlersMap[_handler];
    }
}
