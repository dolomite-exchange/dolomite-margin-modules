// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title   IJonesStableVaultV1
 * @author  Jones
 *
 * @notice  Interface for interacting with Jones DAO's StableVaultV1
 */
interface IJonesStableVaultV1 {

    function totalSupply() external view returns (uint256);
}