"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJonesUSDCIsolationModeWrapperTraderV2 = exports.createJonesUSDCRegistry = exports.createJonesUSDCIsolationModeUnwrapperTraderV2 = exports.createJonesUSDCPriceOracle = exports.createJonesUSDCIsolationModeTokenVaultV1 = exports.createJonesUSDCIsolationModeVaultFactory = void 0;
const types_1 = require("../../../src/types");
const jones_1 = require("../../../src/utils/constructors/jones");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
function createJonesUSDCIsolationModeVaultFactory(core, jonesUSDCRegistry, jUSDCToken, userVaultImplementation) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCIsolationModeVaultFactory__factory.abi, types_1.JonesUSDCIsolationModeVaultFactory__factory.bytecode, (0, jones_1.getJonesUSDCIsolationModeVaultFactoryConstructorParams)(core, jonesUSDCRegistry, jUSDCToken, userVaultImplementation));
}
exports.createJonesUSDCIsolationModeVaultFactory = createJonesUSDCIsolationModeVaultFactory;
function createJonesUSDCIsolationModeTokenVaultV1() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCIsolationModeTokenVaultV1__factory.abi, types_1.JonesUSDCIsolationModeTokenVaultV1__factory.bytecode, []);
}
exports.createJonesUSDCIsolationModeTokenVaultV1 = createJonesUSDCIsolationModeTokenVaultV1;
function createJonesUSDCPriceOracle(core, jonesUSDCRegistry, djUSDCToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCPriceOracle__factory.abi, types_1.JonesUSDCPriceOracle__factory.bytecode, (0, jones_1.getJonesUSDCPriceOracleConstructorParams)(core, jonesUSDCRegistry, djUSDCToken));
}
exports.createJonesUSDCPriceOracle = createJonesUSDCPriceOracle;
function createJonesUSDCIsolationModeUnwrapperTraderV2(core, jonesUSDCRegistry, djUSDCToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCIsolationModeUnwrapperTraderV2__factory.abi, types_1.JonesUSDCIsolationModeUnwrapperTraderV2__factory.bytecode, (0, jones_1.getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams)(core, jonesUSDCRegistry, djUSDCToken));
}
exports.createJonesUSDCIsolationModeUnwrapperTraderV2 = createJonesUSDCIsolationModeUnwrapperTraderV2;
function createJonesUSDCRegistry(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCRegistry__factory.abi, types_1.JonesUSDCRegistry__factory.bytecode, (0, jones_1.getJonesUSDCRegistryConstructorParams)(core));
}
exports.createJonesUSDCRegistry = createJonesUSDCRegistry;
function createJonesUSDCIsolationModeWrapperTraderV2(core, jonesRegistry, djUSDCToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.JonesUSDCIsolationModeWrapperTraderV2__factory.abi, types_1.JonesUSDCIsolationModeWrapperTraderV2__factory.bytecode, (0, jones_1.getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams)(core, jonesRegistry, djUSDCToken));
}
exports.createJonesUSDCIsolationModeWrapperTraderV2 = createJonesUSDCIsolationModeWrapperTraderV2;
