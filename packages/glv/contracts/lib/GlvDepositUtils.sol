// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";


/**
 * @title   GlvDepositUtils
 *
 * @notice  GlvDepositUtils library from GMX
 */
library GlvDepositUtils {
    struct CreateGlvDepositParams {
        CreateGlvDepositParamsAddresses addresses;
        uint256 minGlvTokens;
        uint256 executionFee;
        uint256 callbackGasLimit;
        bool shouldUnwrapNativeToken;
        bool isMarketTokenDeposit;
        bytes32[] dataList;
    }

    struct CreateGlvDepositParamsAddresses {
        address glv;
        address market;
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
    }

    struct CreateGlvDepositCache {
        uint256 marketTokenAmount;
        uint256 initialLongTokenAmount;
        uint256 initialShortTokenAmount;
    }

    // struct ExecuteGlvDepositParams {
    //     IGmxDataStore dataStore;
    //     EventEmitter eventEmitter;
    //     GlvVault glvVault;
    //     Oracle oracle;
    //     bytes32 key;
    //     uint256 startingGas;
    //     address keeper;
    // }

    // struct ExecuteGlvDepositCache {
    //     Market.Props market;
    //     MarketPoolValueInfo.Props marketPoolValueInfo;
    //     uint256 marketTokenSupply;
    //     uint256 receivedMarketTokens;
    //     uint256 mintAmount;
    //     uint256 marketCount;
    //     uint256 oraclePriceCount;
    //     uint256 glvValue;
    //     uint256 glvSupply;
    // }

    // struct CancelGlvDepositParams {
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
