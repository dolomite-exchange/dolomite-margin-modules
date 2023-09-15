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


/**
 * @title   GmxDeposit
 * @author  Dolomite
 *
 */
library GmxDeposit {
    // @dev there is a limit on the number of fields a struct can have when being passed
    // or returned as a memory variable which can cause "Stack too deep" errors
    // use sub-structs to avoid this issue
    // @param  addresses address values
    // @param  numbers number values
    // @param  flags boolean values
    struct DepositProps {
        Addresses addresses;
        Numbers numbers;
        Flags flags;
    }

    // @param  account the account depositing liquidity
    // @param  receiver the address to send the liquidity tokens to
    // @param  callbackContract the callback contract
    // @param  uiFeeReceiver the ui fee receiver
    // @param  market the market to deposit to
    struct Addresses {
        address account;
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
    }

    // @param  initialLongTokenAmount the amount of long tokens to deposit
    // @param  initialShortTokenAmount the amount of short tokens to deposit
    // @param  minMarketTokens the minimum acceptable number of liquidity tokens
    // @param  updatedAtBlock the block that the deposit was last updated at
    //        sending funds back to the user in case the deposit gets cancelled
    // @param  executionFee the execution fee for keepers
    // @param  callbackGasLimit the gas limit for the callbackContract
    struct Numbers {
        uint256 initialLongTokenAmount;
        uint256 initialShortTokenAmount;
        uint256 minMarketTokens;
        uint256 updatedAtBlock;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    // @param  shouldUnwrapNativeToken whether to unwrap the native token when
    struct Flags {
        bool shouldUnwrapNativeToken;
    }

    function account(DepositProps memory props) internal pure returns (address) {
        return props.addresses.account;
    }

    function setAccount(DepositProps memory props, address value) internal pure {
        props.addresses.account = value;
    }

    function receiver(DepositProps memory props) internal pure returns (address) {
        return props.addresses.receiver;
    }

    function setReceiver(DepositProps memory props, address value) internal pure {
        props.addresses.receiver = value;
    }

    function callbackContract(DepositProps memory props) internal pure returns (address) {
        return props.addresses.callbackContract;
    }

    function setCallbackContract(DepositProps memory props, address value) internal pure {
        props.addresses.callbackContract = value;
    }

    function uiFeeReceiver(DepositProps memory props) internal pure returns (address) {
        return props.addresses.uiFeeReceiver;
    }

    function setUiFeeReceiver(DepositProps memory props, address value) internal pure {
        props.addresses.uiFeeReceiver = value;
    }

    function market(DepositProps memory props) internal pure returns (address) {
        return props.addresses.market;
    }

    function setMarket(DepositProps memory props, address value) internal pure {
        props.addresses.market = value;
    }

    function initialLongToken(DepositProps memory props) internal pure returns (address) {
        return props.addresses.initialLongToken;
    }

    function setInitialLongToken(DepositProps memory props, address value) internal pure {
        props.addresses.initialLongToken = value;
    }

    function initialShortToken(DepositProps memory props) internal pure returns (address) {
        return props.addresses.initialShortToken;
    }

    function setInitialShortToken(DepositProps memory props, address value) internal pure {
        props.addresses.initialShortToken = value;
    }

    function longTokenSwapPath(DepositProps memory props) internal pure returns (address[] memory) {
        return props.addresses.longTokenSwapPath;
    }

    function setLongTokenSwapPath(DepositProps memory props, address[] memory value) internal pure {
        props.addresses.longTokenSwapPath = value;
    }

    function shortTokenSwapPath(DepositProps memory props) internal pure returns (address[] memory) {
        return props.addresses.shortTokenSwapPath;
    }

    function setShortTokenSwapPath(DepositProps memory props, address[] memory value) internal pure {
        props.addresses.shortTokenSwapPath = value;
    }

    function initialLongTokenAmount(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.initialLongTokenAmount;
    }

    function setInitialLongTokenAmount(DepositProps memory props, uint256 value) internal pure {
        props.numbers.initialLongTokenAmount = value;
    }

    function initialShortTokenAmount(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.initialShortTokenAmount;
    }

    function setInitialShortTokenAmount(DepositProps memory props, uint256 value) internal pure {
        props.numbers.initialShortTokenAmount = value;
    }

    function minMarketTokens(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.minMarketTokens;
    }

    function setMinMarketTokens(DepositProps memory props, uint256 value) internal pure {
        props.numbers.minMarketTokens = value;
    }

    function updatedAtBlock(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.updatedAtBlock;
    }

    function setUpdatedAtBlock(DepositProps memory props, uint256 value) internal pure {
        props.numbers.updatedAtBlock = value;
    }

    function executionFee(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.executionFee;
    }

    function setExecutionFee(DepositProps memory props, uint256 value) internal pure {
        props.numbers.executionFee = value;
    }

    function callbackGasLimit(DepositProps memory props) internal pure returns (uint256) {
        return props.numbers.callbackGasLimit;
    }

    function setCallbackGasLimit(DepositProps memory props, uint256 value) internal pure {
        props.numbers.callbackGasLimit = value;
    }

    function shouldUnwrapNativeToken(DepositProps memory props) internal pure returns (bool) {
        return props.flags.shouldUnwrapNativeToken;
    }

    function setShouldUnwrapNativeToken(DepositProps memory props, bool value) internal pure {
        props.flags.shouldUnwrapNativeToken = value;
    }
}
