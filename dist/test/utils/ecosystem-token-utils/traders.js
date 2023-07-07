"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParaswapAggregatorTrader = void 0;
const types_1 = require("../../../src/types");
const traders_1 = require("../../../src/utils/constructors/traders");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
async function createParaswapAggregatorTrader(core) {
    return await (0, dolomite_utils_1.createContractWithAbi)(types_1.ParaswapAggregatorTrader__factory.abi, types_1.ParaswapAggregatorTrader__factory.bytecode, (0, traders_1.getParaswapAggregatorTraderConstructorParams)(core));
}
exports.createParaswapAggregatorTrader = createParaswapAggregatorTrader;
