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
    //      or returned as a memory variable which can cause "Stack too deep" errors
    //      use sub-structs to avoid this issue
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
    // @param  executionFee the execution fee for keepers
    // @param  callbackGasLimit the gas limit for the callbackContract
    struct Numbers {
        uint256 initialLongTokenAmount;
        uint256 initialShortTokenAmount;
        uint256 minMarketTokens;
        uint256 updatedAtTime;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    // @param  shouldUnwrapNativeToken whether to unwrap the native token when
    struct Flags {
        bool shouldUnwrapNativeToken;
    }
}
