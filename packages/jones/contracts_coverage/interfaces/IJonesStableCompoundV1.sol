// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title   IJonesStableCompoundV1
 * @author  Jones
 *
 * @notice  Interface for interacting with Jones DAO's StableCompoundV1
 */
interface IJonesStableCompoundV1 {

    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
