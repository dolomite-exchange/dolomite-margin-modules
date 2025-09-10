// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GlvDepositUtils } from "../lib/GlvDepositUtils.sol";
import { GlvOracleUtils } from "../lib/GlvOracleUtils.sol";
import { GlvWithdrawalUtils } from "../lib/GlvWithdrawalUtils.sol";


/**
 * @title   IGlvRouter
 *
 * @notice  IGlvRouter library from GMX
 */
interface IGlvRouter {
    function createGlvDeposit(
        GlvDepositUtils.CreateGlvDepositParams calldata params
    ) external payable returns (bytes32);

    function cancelGlvDeposit(bytes32 key) external;

    function simulateExecuteGlvDeposit(
        bytes32 key,
        GlvOracleUtils.SimulatePricesParams memory simulatedOracleParams
    ) external payable;

    function createGlvWithdrawal(
        GlvWithdrawalUtils.CreateGlvWithdrawalParams calldata params
    ) external payable returns (bytes32);

    function cancelGlvWithdrawal(bytes32 key) external;

    function simulateExecuteGlvWithdrawal(
        bytes32 key,
        GlvOracleUtils.SimulatePricesParams memory simulatedOracleParams
    ) external payable;

    // makeExternalCalls can be used to perform an external swap before
    // an action
    // example:
    // - ExchangeRouter.sendTokens(token: WETH, receiver: externalHandler, amount: 1e18)
    // - ExchangeRouter.makeExternalCalls(
    //     WETH.approve(spender: aggregator, amount: 1e18),
    //     aggregator.swap(amount: 1, from: WETH, to: USDC, receiver: orderHandler)
    // )
    // - ExchangeRouter.createOrder
    // the msg.sender for makeExternalCalls would be externalHandler
    // refundTokens can be used to retrieve any excess tokens that may
    // be left in the externalHandler
    function makeExternalCalls(
        address[] memory externalCallTargets,
        bytes[] memory externalCallDataList,
        address[] memory refundTokens,
        address[] memory refundReceivers
    ) external;

    function sendWnt(address receiver, uint256 amount) external payable;

    function sendTokens(address token, address receiver, uint256 amount) external;

    function router() external view returns (address);

    function glvDepositHandler() external view returns (address);

    function glvWithdrawalHandler() external view returns (address);
}
