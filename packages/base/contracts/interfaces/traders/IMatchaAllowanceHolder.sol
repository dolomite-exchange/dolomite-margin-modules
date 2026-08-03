// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;


/**
 * @title   IMatchaAllowanceHolder
 *
 * @notice  Matcha allowance holder
 */
interface IMatchaAllowanceHolder {

    function exec(
        address operator,
        address token,
        uint256 amount,
        address payable target,
        bytes calldata data
    ) external returns (bytes memory);
}
