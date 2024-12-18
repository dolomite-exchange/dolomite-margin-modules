// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;


/**
 * @title   GlvWithdrawalUtils
 *
 * @notice  GlvWithdrawalUtils library from GMX
 */
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
}
