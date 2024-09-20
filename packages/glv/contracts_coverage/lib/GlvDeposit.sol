// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

// @title GlvDeposit
// @dev Struct for GLV deposits
library GlvDeposit {
    // @dev there is a limit on the number of fields a struct can have when being passed
    // or returned as a memory variable which can cause "Stack too deep" errors
    // use sub-structs to avoid this issue
    // large number of fields my also cause incorrect display in Tenderly
    // @param addresses address values
    // @param numbers number values
    // @param flags boolean values
    struct Props {
        Addresses addresses;
        Numbers numbers;
        Flags flags;
    }

    // @param account the account depositing liquidity
    // @param receiver the address to send the liquidity tokens to
    // @param callbackContract the callback contract
    // @param uiFeeReceiver the ui fee receiver
    // @param market the market to deposit to
    struct Addresses {
        address glv;
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

    // @param marketTokenAmount the amount of market tokens to deposit
    // @param initialLongTokenAmount the amount of long tokens to deposit
    // @param initialShortTokenAmount the amount of short tokens to deposit
    // @param minGlvTokens the minimum acceptable number of Glv tokens
    // sending funds back to the user in case the deposit gets cancelled
    // @param executionFee the execution fee for keepers
    // @param callbackGasLimit the gas limit for the callbackContract
    struct Numbers {
        uint256 marketTokenAmount;
        uint256 initialLongTokenAmount;
        uint256 initialShortTokenAmount;
        uint256 minGlvTokens;
        uint256 updatedAtTime;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    // @param shouldUnwrapNativeToken whether to unwrap the native token when
    // @param isMarketTokenDeposit whether to deposit market tokens or long/short tokens
    struct Flags {
        bool shouldUnwrapNativeToken;
        bool isMarketTokenDeposit;
    }
}
