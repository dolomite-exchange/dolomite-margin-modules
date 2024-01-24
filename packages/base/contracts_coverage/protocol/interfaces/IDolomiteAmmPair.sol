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

import { IDolomiteMargin } from "./IDolomiteMargin.sol";


/**
 * @title   IDolomiteAmmPair
 * @author  Dolomite
 *
 * @notice This interface defines the functions callable on Dolomite's native AMM pools.
 */
interface IDolomiteAmmPair {

    // ==========================================================
    // ========================= Events =========================
    // ==========================================================

    event Approval(address indexed owner, address indexed spender, uint value);

    event Transfer(address indexed from, address indexed to, uint value);

    event Mint(address indexed sender, uint amount0Wei, uint amount1Wei);

    event Burn(
        address indexed sender,
        uint amount0Wei,
        uint amount1Wei,
        address indexed to
    );

    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );

    event Sync(uint112 reserve0, uint112 reserve1);

    // ==========================================================
    // ==================== Write Functions =====================
    // ==========================================================

    function approve(address spender, uint value) external returns (bool);

    function transfer(address to, uint value) external returns (bool);

    function transferFrom(address from, address to, uint value) external returns (bool);

    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mint(address to) external returns (uint liquidity);

    function burn(address to, uint toAccountNumber) external returns (uint amount0Wei, uint amount1Wei);

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteMargin.AccountInfo calldata makerAccount,
        IDolomiteMargin.AccountInfo calldata takerAccount,
        IDolomiteMargin.Par calldata,
        IDolomiteMargin.Par calldata,
        IDolomiteMargin.Wei calldata inputWei,
        bytes calldata data
    )
    external
    returns (IDolomiteMargin.AssetAmount memory);

    function skim(address to, uint toAccountNumber) external;

    function sync() external;

    function initialize(address _token0, address _token1, address _transferProxy) external;

    // ==========================================================
    // ==================== Read Functions =====================
    // ==========================================================

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint);

    function balanceOf(address owner) external view returns (uint);

    function allowance(address owner, address spender) external view returns (uint);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function nonces(address owner) external view returns (uint);

    function factory() external view returns (address);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReservesWei() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    function getReservesPar() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    function price0CumulativeLast() external view returns (uint);

    function price1CumulativeLast() external view returns (uint);

    function kLast() external view returns (uint);

    function PERMIT_TYPEHASH() external pure returns (bytes32);

    function MINIMUM_LIQUIDITY() external pure returns (uint);

    function decimals() external pure returns (uint8);
}
