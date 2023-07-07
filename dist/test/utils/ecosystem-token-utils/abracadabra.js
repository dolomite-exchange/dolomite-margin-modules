"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMagicGLPWrapperTraderV2 = exports.createMagicGLPWrapperTraderV1 = exports.createMagicGLPUnwrapperTraderV2 = exports.createMagicGLPUnwrapperTraderV1 = exports.createMagicGLPPriceOracle = void 0;
const types_1 = require("../../../src/types");
const abracadabra_1 = require("../../../src/utils/constructors/abracadabra");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
async function createMagicGLPPriceOracle(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPPriceOracle__factory.abi, types_1.MagicGLPPriceOracle__factory.bytecode, (0, abracadabra_1.getMagicGLPPriceOracleConstructorParams)(core));
}
exports.createMagicGLPPriceOracle = createMagicGLPPriceOracle;
async function createMagicGLPUnwrapperTraderV1(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPUnwrapperTraderV1__factory.abi, types_1.MagicGLPUnwrapperTraderV1__factory.bytecode, (0, abracadabra_1.getMagicGLPUnwrapperTraderV1ConstructorParams)(core));
}
exports.createMagicGLPUnwrapperTraderV1 = createMagicGLPUnwrapperTraderV1;
async function createMagicGLPUnwrapperTraderV2(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPUnwrapperTraderV2__factory.abi, types_1.MagicGLPUnwrapperTraderV2__factory.bytecode, (0, abracadabra_1.getMagicGLPUnwrapperTraderV2ConstructorParams)(core));
}
exports.createMagicGLPUnwrapperTraderV2 = createMagicGLPUnwrapperTraderV2;
async function createMagicGLPWrapperTraderV1(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPWrapperTraderV1__factory.abi, types_1.MagicGLPWrapperTraderV1__factory.bytecode, (0, abracadabra_1.getMagicGLPWrapperTraderV1ConstructorParams)(core));
}
exports.createMagicGLPWrapperTraderV1 = createMagicGLPWrapperTraderV1;
async function createMagicGLPWrapperTraderV2(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPWrapperTraderV2__factory.abi, types_1.MagicGLPWrapperTraderV2__factory.bytecode, (0, abracadabra_1.getMagicGLPWrapperTraderV2ConstructorParams)(core));
}
exports.createMagicGLPWrapperTraderV2 = createMagicGLPWrapperTraderV2;
