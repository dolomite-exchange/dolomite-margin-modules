// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

interface IGmxRouter {
    function pluginTransfer(address token, address account, address receiver, uint256 amount) external;
}
