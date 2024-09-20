// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

library GlvWithdrawalUtils {

    struct CreateGlvWithdrawalParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address glv;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    // struct ExecuteGlvWithdrawalParams {
    //     DataStore dataStore;
    //     EventEmitter eventEmitter;
    //     GlvVault glvVault;
    //     Oracle oracle;
    //     bytes32 key;
    //     uint256 startingGas;
    //     address keeper;
    // }

    // struct ExecuteGlvWithdrawalCache {
    //     uint256 glvValue;
    //     uint256 marketCount;
    //     uint256 oraclePriceCount;
    //     uint256 marketTokenAmount;
    // }

    // struct CancelGlvWithdrawalParams {
    //     DataStore dataStore;
    //     EventEmitter eventEmitter;
    //     GlvVault glvVault;
    //     bytes32 key;
    //     address keeper;
    //     uint256 startingGas;
    //     string reason;
    //     bytes reasonBytes;
    // }
}
