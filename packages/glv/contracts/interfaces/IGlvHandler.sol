// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { GlvDepositUtils } from "../lib/GlvDepositUtils.sol";
import { GlvWithdrawalUtils } from "../lib/GlvWithdrawalUtils.sol";
import { GlvOracleUtils } from "../lib/GlvOracleUtils.sol";

interface IGlvHandler {
    function createGlvDeposit(
        address account,
        GlvDepositUtils.CreateGlvDepositParams calldata params
    ) external payable returns (bytes32);

    function cancelGlvDeposit(bytes32 key) external;

    function simulateExecuteGlvDeposit(bytes32 key, GlvOracleUtils.SimulatePricesParams memory params) external;

    function createGlvWithdrawal(
        address account,
        GlvWithdrawalUtils.CreateGlvWithdrawalParams calldata params
    ) external payable returns (bytes32);

    function cancelGlvWithdrawal(bytes32 key) external;

    function simulateExecuteGlvWithdrawal(bytes32 key, GlvOracleUtils.SimulatePricesParams memory params) external;

    function executeGlvDeposit(
        bytes32 key,
        GlvOracleUtils.SetPricesParams calldata oracleParams
    ) external;

    function executeGlvWithdrawal(
        bytes32 key,
        GlvOracleUtils.SetPricesParams calldata oracleParams
    ) external;
}
