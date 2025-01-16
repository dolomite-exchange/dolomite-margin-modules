// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { IDOLO } from "./interfaces/IDOLO.sol";


/**
 * @title   DOLO
 * @author  Dolomite
 *
 * ERC20 contract for DOLO token
 */
contract DOLO is ERC20Burnable, OnlyDolomiteMargin, IDOLO {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "DOLO";

    // ===================================================
    // ================== State Variables ================
    // ===================================================

    address public ccipAdmin;
    mapping(address => bool) public minters;

    // ==================================================================
    // ======================= Modifiers ===============================
    // ==================================================================

    modifier onlyMinter(address _minter) {
        Require.that(
            minters[_minter],
            _FILE,
            "Not a minter"
        );
        _;
    }

    // ==================================================================
    // ========================= Constructor ============================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        address _treasury
    ) ERC20("Dolomite", "DOLO") OnlyDolomiteMargin(_dolomiteMargin) {
        _mint(_treasury, 1_000_000_000 ether);
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function mint(address _account, uint256 _amount) external onlyMinter(msg.sender) {
        Require.that(
            _account != address(this),
            _FILE,
            "Invalid account"
        );

        _mint(_account, _amount);
    }

    // ==================================================================
    // ======================== Admin Functions =========================
    // ==================================================================

    function ownerSetCCIPAdmin(address _ccipAdmin) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCCIPAdmin(_ccipAdmin);
    }

    function ownerSetMinter(address _minter, bool _isMinter) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMinter(_minter, _isMinter);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function getCCIPAdmin() external view returns (address) {
        return ccipAdmin;
    }

    function isMinter(address _minter) external view returns (bool) {
        return minters[_minter];
    }

    function owner() external view returns (address) {
        return DOLOMITE_MARGIN_OWNER();
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _transfer(address _from, address _to, uint256 _amount) internal override {
        Require.that(
            _to != address(this),
            _FILE,
            "Invalid recipient"
        );
        super._transfer(_from, _to, _amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) internal override {
        Require.that(
            _spender != address(this),
            _FILE,
            "Invalid spender"
        );
        super._approve(_owner, _spender, _amount);
    }

    function _ownerSetCCIPAdmin(address _ccipAdmin) internal {
        Require.that(
            _ccipAdmin != address(0),
            _FILE,
            "Invalid CCIP admin"
        );
        ccipAdmin = _ccipAdmin;
        emit CCIPAdminSet(_ccipAdmin);
    }

    function _ownerSetMinter(address _minter, bool _isMinter) internal {
        Require.that(
            _minter != address(0),
            _FILE,
            "Invalid minter"
        );
        minters[_minter] = _isMinter;
        emit MinterSet(_minter, _isMinter);
    }
}
