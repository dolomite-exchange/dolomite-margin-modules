// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { IDolomiteERC20 } from "../interfaces/IDolomiteERC20.sol";


/**
 * @title   TestDolomiteERC20User
 * @author  Dolomite
 *
 * @dev Test user for DolomiteERC20
 */
contract TestDolomiteERC20User {

    IDolomiteERC20 public immutable DOLOMITE_ERC20;

    constructor(
        address _dolomiteERC20
    ) {
        DOLOMITE_ERC20 = IDolomiteERC20(_dolomiteERC20);
    }

    function transfer(address to, uint256 amount) external {
        DOLOMITE_ERC20.transfer(to, amount);
    }
}
