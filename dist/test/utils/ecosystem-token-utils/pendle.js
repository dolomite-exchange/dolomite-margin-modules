"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPendlePtGLP2024IsolationModeVaultFactory = exports.createPendlePtGLP2024IsolationModeWrapperTraderV2 = exports.createPendlePtGLP2024IsolationModeUnwrapperTraderV2 = exports.createPendlePtGLPPriceOracle = exports.createPendlePtGLP2024IsolationModeTokenVaultV1 = exports.createPendlePtGLP2024Registry = void 0;
const types_1 = require("../../../src/types");
const pendle_1 = require("../../../src/utils/constructors/pendle");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
function createPendlePtGLP2024Registry(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLP2024Registry__factory.abi, types_1.PendlePtGLP2024Registry__factory.bytecode, (0, pendle_1.getPendlePtGLP2024RegistryConstructorParams)(core));
}
exports.createPendlePtGLP2024Registry = createPendlePtGLP2024Registry;
function createPendlePtGLP2024IsolationModeTokenVaultV1() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory.abi, types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory.bytecode, []);
}
exports.createPendlePtGLP2024IsolationModeTokenVaultV1 = createPendlePtGLP2024IsolationModeTokenVaultV1;
function createPendlePtGLPPriceOracle(core, dptGlp, pendleRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLPPriceOracle__factory.abi, types_1.PendlePtGLPPriceOracle__factory.bytecode, (0, pendle_1.getPendlePtGLPPriceOracleConstructorParams)(core, dptGlp, pendleRegistry));
}
exports.createPendlePtGLPPriceOracle = createPendlePtGLPPriceOracle;
function createPendlePtGLP2024IsolationModeUnwrapperTraderV2(core, dptGlp, pendleRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.abi, types_1.PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.bytecode, (0, pendle_1.getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams)(core, dptGlp, pendleRegistry));
}
exports.createPendlePtGLP2024IsolationModeUnwrapperTraderV2 = createPendlePtGLP2024IsolationModeUnwrapperTraderV2;
function createPendlePtGLP2024IsolationModeWrapperTraderV2(core, dptGlp, pendleRegistry) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLP2024IsolationModeWrapperTraderV2__factory.abi, types_1.PendlePtGLP2024IsolationModeWrapperTraderV2__factory.bytecode, (0, pendle_1.getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams)(core, dptGlp, pendleRegistry));
}
exports.createPendlePtGLP2024IsolationModeWrapperTraderV2 = createPendlePtGLP2024IsolationModeWrapperTraderV2;
function createPendlePtGLP2024IsolationModeVaultFactory(core, registry, ptGlpToken, userVaultImplementation) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PendlePtGLP2024IsolationModeVaultFactory__factory.abi, types_1.PendlePtGLP2024IsolationModeVaultFactory__factory.bytecode, (0, pendle_1.getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams)(core, registry, ptGlpToken, userVaultImplementation));
}
exports.createPendlePtGLP2024IsolationModeVaultFactory = createPendlePtGLP2024IsolationModeVaultFactory;
