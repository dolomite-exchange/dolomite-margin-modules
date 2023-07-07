"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalldataForParaswap = exports.checkForParaswapSuccess = exports.liquidateV4WithZap = exports.liquidateV4WithLiquidityToken = exports.liquidateV4WithIsolationMode = exports.getLastZapAmountToBigNumber = exports.toZapBigNumber = exports.getParaswapTraderParamStruct = void 0;
const dist_1 = require("@dolomite-exchange/zap-sdk/dist");
const GenericTraderProxyV1_1 = require("@dolomite-margin/dist/src/modules/GenericTraderProxyV1");
const axios_1 = __importDefault(require("axios"));
const ethers_1 = require("ethers");
const no_deps_constants_1 = require("../../src/utils/no-deps-constants");
const assertions_1 = require("./assertions");
const API_URL = 'https://apiv5.paraswap.io';
function getParaswapTraderParamStruct(core, encodedTradeData) {
    return {
        traderType: GenericTraderProxyV1_1.GenericTraderType.ExternalLiquidity,
        makerAccountIndex: 0,
        trader: core.paraswapTrader.address,
        tradeData: encodedTradeData,
    };
}
exports.getParaswapTraderParamStruct = getParaswapTraderParamStruct;
function toZapBigNumber(amount) {
    return new dist_1.BigNumber(amount.toString());
}
exports.toZapBigNumber = toZapBigNumber;
function getLastZapAmountToBigNumber(zapOutput) {
    return ethers_1.BigNumber.from(zapOutput.amountWeisPath[zapOutput.amountWeisPath.length - 1].toString());
}
exports.getLastZapAmountToBigNumber = getLastZapAmountToBigNumber;
async function liquidateV4WithIsolationMode(core, solidAccountStruct, liquidAccountStruct, marketIdsPath, amountWeisPath, unwrapper, unwrapperTradeData = no_deps_constants_1.BYTES_EMPTY, paraswapTraderParam = no_deps_constants_1.NO_PARASWAP_TRADER_PARAM, expiry = no_deps_constants_1.NO_EXPIRY) {
    const defaultUnwrapperTraderParam = {
        traderType: GenericTraderProxyV1_1.GenericTraderType.IsolationModeUnwrapper,
        makerAccountIndex: 0,
        trader: unwrapper.address,
        tradeData: unwrapperTradeData,
    };
    const tradersPath = [defaultUnwrapperTraderParam];
    if (paraswapTraderParam) {
        tradersPath.push(paraswapTraderParam);
    }
    return core.liquidatorProxyV4.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, marketIdsPath, amountWeisPath, tradersPath, [], expiry);
}
exports.liquidateV4WithIsolationMode = liquidateV4WithIsolationMode;
async function liquidateV4WithLiquidityToken(core, solidAccountStruct, liquidAccountStruct, marketIdsPath, amountWeisPath, unwrapper, unwrapperTradeData = no_deps_constants_1.BYTES_EMPTY, paraswapTraderParam = no_deps_constants_1.NO_PARASWAP_TRADER_PARAM, expiry = no_deps_constants_1.NO_EXPIRY) {
    const defaultUnwrapperTraderParam = {
        traderType: GenericTraderProxyV1_1.GenericTraderType.ExternalLiquidity,
        makerAccountIndex: 0,
        trader: unwrapper.address,
        tradeData: unwrapperTradeData,
    };
    const tradersPath = [defaultUnwrapperTraderParam];
    if (paraswapTraderParam) {
        tradersPath.push(paraswapTraderParam);
    }
    return core.liquidatorProxyV4.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, marketIdsPath, amountWeisPath, tradersPath, [], expiry);
}
exports.liquidateV4WithLiquidityToken = liquidateV4WithLiquidityToken;
async function liquidateV4WithZap(core, solidAccountStruct, liquidAccountStruct, zapOutputs, expiry = no_deps_constants_1.NO_EXPIRY) {
    let latestError = new Error('No zap output found');
    for (let i = 0; i < zapOutputs.length; i++) {
        const zapOutput = zapOutputs[i];
        const amountWeisPath = zapOutput.amountWeisPath.map((amount, i) => {
            if (i === zapOutput.amountWeisPath.length - 1) {
                return ethers_1.ethers.constants.MaxUint256.toString();
            }
            if (i === 0) {
                return ethers_1.ethers.constants.MaxUint256.toString();
            }
            return amount.toString();
        });
        try {
            return await core.liquidatorProxyV4.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, zapOutput.marketIdsPath, amountWeisPath, zapOutput.traderParams, zapOutput.makerAccounts, expiry);
        }
        catch (e) {
            console.warn(`Failed to liquidate with zap at index ${i}. Trying next zap output...`, e);
            latestError = e;
        }
    }
    return Promise.reject(latestError);
}
exports.liquidateV4WithZap = liquidateV4WithZap;
async function checkForParaswapSuccess(contractTransactionPromise) {
    try {
        const txResult = await contractTransactionPromise;
        const receipt = await txResult.wait();
        console.log('\t#liquidate gas used:', receipt.gasUsed.toString());
        return true;
    }
    catch (e) {
        await (0, assertions_1.expectThrow)(contractTransactionPromise, 'ParaswapAggregatorTrader: External call failed');
        console.warn('\tParaswap call failed. This can happen when mixing a mainnet data with the test environment. Skipping the rest of the test');
        return false;
    }
}
exports.checkForParaswapSuccess = checkForParaswapSuccess;
async function getCalldataForParaswap(inputAmount, inputToken, inputDecimals, minOutputAmount, outputToken, outputDecimals, txOrigin, receiver, core) {
    const priceRouteResponse = await axios_1.default.get(`${API_URL}/prices`, {
        params: {
            network: core.config.network,
            srcToken: inputToken.address,
            srcDecimals: inputDecimals,
            destToken: outputToken.address,
            destDecimals: outputDecimals,
            amount: inputAmount.toString(),
            includeContractMethods: 'simpleSwap,multiSwap,megaSwap',
        },
    })
        .then(response => response.data)
        .catch((error) => {
        console.error('Found error in prices', error);
        throw error;
    });
    const queryParams = new URLSearchParams({
        ignoreChecks: 'true',
        ignoreGasEstimate: 'true',
        onlyParams: 'false',
    }).toString();
    const result = await axios_1.default.post(`${API_URL}/transactions/${core.config.network}?${queryParams}`, {
        priceRoute: priceRouteResponse === null || priceRouteResponse === void 0 ? void 0 : priceRouteResponse.priceRoute,
        txOrigin: txOrigin.address,
        srcToken: inputToken.address,
        srcDecimals: inputDecimals,
        destToken: outputToken.address,
        destDecimals: outputDecimals,
        srcAmount: inputAmount.toString(),
        destAmount: minOutputAmount.toString(),
        userAddress: receiver.address,
        receiver: receiver.address,
        deadline: 9999999999,
    })
        .then(response => response.data)
        .catch((error) => {
        console.error('Found error in transactions', error);
        throw error;
    });
    return {
        calldata: result.data,
        outputAmount: ethers_1.BigNumber.from(ethers_1.BigNumber.from(priceRouteResponse.priceRoute.destAmount)),
    };
}
exports.getCalldataForParaswap = getCalldataForParaswap;
