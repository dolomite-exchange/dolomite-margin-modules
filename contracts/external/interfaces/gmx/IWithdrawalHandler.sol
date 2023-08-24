// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

interface IWithdrawalHandler {
        /**
     * @param receiver The address that will receive the withdrawal tokens.
     * @param callbackContract The contract that will be called back.
     * @param market The market on which the withdrawal will be executed.
     * @param minLongTokenAmount The minimum amount of long tokens that must be withdrawn.
     * @param minShortTokenAmount The minimum amount of short tokens that must be withdrawn.
     * @param shouldUnwrapNativeToken Whether the native token should be unwrapped when executing the withdrawal.
     * @param executionFee The execution fee for the withdrawal.
     * @param callbackGasLimit The gas limit for calling the callback contract.
     */
    struct CreateWithdrawalParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    struct Props {
        uint256 min;
        uint256 max;
    }

    struct SimulatePricesParams {
        address[] primaryTokens;
        Props[] primaryPrices;
    }

    function createWithdrawal(address account, CreateWithdrawalParams calldata params) external returns (bytes32);

    function cancelWithdrawal(bytes32 key) external;

    function simulateExecuteWithdrawal(bytes32 key, SimulatePricesParams memory params) external;
}