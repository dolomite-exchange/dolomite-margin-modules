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
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IDOLO } from "./interfaces/IDOLO.sol";


/**
 * @title   DOLO
 * @author  Dolomite
 *
 * ERC20 contract for DOLO token
 */
contract DOLO is ERC20Burnable, OnlyDolomiteMargin, IDOLO {
    using Address for address;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "DOLO";

    // ===================================================
    // ================== State Variables ================
    // ===================================================

    address private _ccipAdmin;
    mapping(address => bool) private _mintersMap;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyMinter(address _minter) {
        if (_mintersMap[_minter]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _mintersMap[_minter],
            _FILE,
            "Not a minter"
        );
        _;
    }

    // ===================================================
    // =================== Constructor ===================
    // ===================================================

    constructor(
        address _dolomiteMargin,
        address _treasury
    ) ERC20("Dolomite", "DOLO") OnlyDolomiteMargin(_dolomiteMargin) {
        _mint(_treasury, 1_000_000_000 ether);
    }

    // ===================================================
    // ================ External Functions ===============
    // ===================================================

    function mint(address _account, uint256 _amount) external onlyMinter(msg.sender) {
        if (_account != address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _account != address(this),
            _FILE,
            "Invalid account"
        );

        _mint(_account, _amount);
    }

    // ===================================================
    // ================= Admin Functions =================
    // ===================================================

    function ownerSetCCIPAdmin(address _newAdmin) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCCIPAdmin(_newAdmin);
    }

    function ownerSetMinter(address _minter, bool _isMinter) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMinter(_minter, _isMinter);
    }

    // ===================================================
    // ================ View Functions ===================
    // ===================================================

    function getCCIPAdmin() external view returns (address) {
        return _ccipAdmin;
    }

    function isMinter(address _minter) external view returns (bool) {
        return _mintersMap[_minter];
    }

    function owner() external view returns (address) {
        return DOLOMITE_MARGIN_OWNER();
    }

    // ===================================================
    // ================ Internal Functions ===============
    // ===================================================

    function _transfer(address _from, address _to, uint256 _amount) internal override {
        if (_to != address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _to != address(this),
            _FILE,
            "Invalid recipient"
        );
        super._transfer(_from, _to, _amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) internal override {
        if (_spender != address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _spender != address(this),
            _FILE,
            "Invalid spender"
        );
        super._approve(_owner, _spender, _amount);
    }

    function _ownerSetCCIPAdmin(address _newAdmin) internal {
        if (_newAdmin != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _newAdmin != address(0),
            _FILE,
            "Invalid CCIP admin"
        );
        _ccipAdmin = _newAdmin;
        emit CCIPAdminSet(_newAdmin);
    }

    function _ownerSetMinter(address _minter, bool _isMinter) internal {
        if (_minter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _minter != address(0),
            _FILE,
            "Invalid minter"
        );
        if (_minter.isContract()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _minter.isContract(),
            _FILE,
            "Minter must be a contract"
        );

        _mintersMap[_minter] = _isMinter;
        emit MinterSet(_minter, _isMinter);
    }
}
