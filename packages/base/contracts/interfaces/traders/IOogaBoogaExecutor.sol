// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @title   IOogaBoogaExecutor
 *
 * @notice  Interface for OogaBooga Executor
 */
interface IOogaBoogaExecutor {
    /// @notice Processes the route generated off-chain. Has a lock
    /// @param  route Encoded call path
    function executePath(bytes calldata route) external payable;
}
