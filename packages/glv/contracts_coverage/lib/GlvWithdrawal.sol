// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

/**
 * @title Withdrawal
 * @dev Struct for withdrawals
 */
library GlvWithdrawal {
    // @dev there is a limit on the number of fields a struct can have when being passed
    // or returned as a memory variable which can cause "Stack too deep" errors
    // use sub-structs to avoid this issue
    // @param addresses address values
    // @param numbers number values
    // @param flags boolean values
    struct Props {
        Addresses addresses;
        Numbers numbers;
        Flags flags;
    }

     // @param account The account to withdraw for.
     // @param receiver The address that will receive the withdrawn tokens.
     // @param callbackContract The contract that will be called back.
     // @param uiFeeReceiver The ui fee receiver.
     // @param market The market on which the withdrawal will be executed.
     // @param glv
    struct Addresses {
        address glv;
        address market;
        address account;
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
    }

     // @param glvTokenAmount The amount of market tokens that will be withdrawn.
     // @param minLongTokenAmount The minimum amount of long tokens that must be withdrawn.
     // @param minShortTokenAmount The minimum amount of short tokens that must be withdrawn.
     // @param executionFee The execution fee for the withdrawal.
     // @param callbackGasLimit The gas limit for calling the callback contract.
    struct Numbers {
        uint256 glvTokenAmount;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        uint256 updatedAtTime;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    // @param shouldUnwrapNativeToken whether to unwrap the native token when
    struct Flags {
        bool shouldUnwrapNativeToken;
    }
}
