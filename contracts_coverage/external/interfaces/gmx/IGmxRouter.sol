// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;


interface IGmxRouter {

    function pluginTransfer(address _token, address _account, address _receiver, uint256 _amount) external;
}
