"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGmxRegistry = exports.createGLPWrapperTraderV2 = exports.createGLPWrapperTraderV1 = exports.createGLPIsolationModeVaultFactory = exports.createGLPIsolationModeTokenVaultV1 = exports.createGLPUnwrapperTraderV2 = exports.createGLPUnwrapperTraderV1 = exports.createGLPPriceOracleV1 = void 0;
const types_1 = require("../../../src/types");
const gmx_1 = require("../../../src/utils/constructors/gmx");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
async function createGLPPriceOracleV1(dfsGlp, gmxRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPPriceOracleV1__factory.abi, types_1.GLPPriceOracleV1__factory.bytecode, (0, gmx_1.getGLPPriceOracleV1ConstructorParams)(dfsGlp, gmxRegistry));
}
exports.createGLPPriceOracleV1 = createGLPPriceOracleV1;
async function createGLPUnwrapperTraderV1(core, dfsGlp, gmxRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeUnwrapperTraderV1__factory.abi, types_1.GLPIsolationModeUnwrapperTraderV1__factory.bytecode, (0, gmx_1.getGLPUnwrapperTraderV1ConstructorParams)(core, dfsGlp, gmxRegistry));
}
exports.createGLPUnwrapperTraderV1 = createGLPUnwrapperTraderV1;
async function createGLPUnwrapperTraderV2(core, dfsGlp, gmxRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeUnwrapperTraderV2__factory.abi, types_1.GLPIsolationModeUnwrapperTraderV2__factory.bytecode, (0, gmx_1.getGLPUnwrapperTraderV2ConstructorParams)(core, dfsGlp, gmxRegistry));
}
exports.createGLPUnwrapperTraderV2 = createGLPUnwrapperTraderV2;
async function createGLPIsolationModeTokenVaultV1() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeTokenVaultV1__factory.abi, types_1.GLPIsolationModeTokenVaultV1__factory.bytecode, []);
}
exports.createGLPIsolationModeTokenVaultV1 = createGLPIsolationModeTokenVaultV1;
async function createGLPIsolationModeVaultFactory(core, gmxRegistry, userVaultImplementation) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeVaultFactory__factory.abi, types_1.GLPIsolationModeVaultFactory__factory.bytecode, (0, gmx_1.getGLPIsolationModeVaultFactoryConstructorParams)(core, gmxRegistry, userVaultImplementation));
}
exports.createGLPIsolationModeVaultFactory = createGLPIsolationModeVaultFactory;
async function createGLPWrapperTraderV1(core, dfsGlp, gmxRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeWrapperTraderV1__factory.abi, types_1.GLPIsolationModeWrapperTraderV1__factory.bytecode, (0, gmx_1.getGLPWrapperTraderV1ConstructorParams)(core, dfsGlp, gmxRegistry));
}
exports.createGLPWrapperTraderV1 = createGLPWrapperTraderV1;
async function createGLPWrapperTraderV2(core, dfsGlp, gmxRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GLPIsolationModeWrapperTraderV2__factory.abi, types_1.GLPIsolationModeWrapperTraderV2__factory.bytecode, (0, gmx_1.getGLPWrapperTraderV2ConstructorParams)(core, dfsGlp, gmxRegistry));
}
exports.createGLPWrapperTraderV2 = createGLPWrapperTraderV2;
function createGmxRegistry(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.GmxRegistryV1__factory.abi, types_1.GmxRegistryV1__factory.bytecode, (0, gmx_1.getGmxRegistryConstructorParams)(core));
}
exports.createGmxRegistry = createGmxRegistry;
