"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUmamiAssetVaultIsolationModeWrapperTraderV2 = exports.createUmamiAssetVaultRegistry = exports.createUmamiAssetVaultIsolationModeUnwrapperTraderV2 = exports.createUmamiAssetVaultPriceOracle = exports.createUmamiAssetVaultIsolationModeTokenVaultV1 = exports.createUmamiAssetVaultIsolationModeVaultFactory = void 0;
const types_1 = require("../../../src/types");
const umami_1 = require("../../../src/utils/constructors/umami");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
async function createUmamiAssetVaultIsolationModeVaultFactory(core, umamiAssetVaultRegistry, umamiAssetVaultToken, underlyingTokenForUmamiVault, userVaultImplementation) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultIsolationModeVaultFactory__factory.abi, types_1.UmamiAssetVaultIsolationModeVaultFactory__factory.bytecode, await (0, umami_1.getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams)(core, umamiAssetVaultRegistry, umamiAssetVaultToken, underlyingTokenForUmamiVault, userVaultImplementation));
}
exports.createUmamiAssetVaultIsolationModeVaultFactory = createUmamiAssetVaultIsolationModeVaultFactory;
function createUmamiAssetVaultIsolationModeTokenVaultV1() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory.abi, types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory.bytecode, []);
}
exports.createUmamiAssetVaultIsolationModeTokenVaultV1 = createUmamiAssetVaultIsolationModeTokenVaultV1;
function createUmamiAssetVaultPriceOracle(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultPriceOracle__factory.abi, types_1.UmamiAssetVaultPriceOracle__factory.bytecode, (0, umami_1.getUmamiAssetVaultPriceOracleConstructorParams)(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken));
}
exports.createUmamiAssetVaultPriceOracle = createUmamiAssetVaultPriceOracle;
function createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory.abi, types_1.UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory.bytecode, (0, umami_1.getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams)(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken));
}
exports.createUmamiAssetVaultIsolationModeUnwrapperTraderV2 = createUmamiAssetVaultIsolationModeUnwrapperTraderV2;
async function createUmamiAssetVaultRegistry(core) {
    const implementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultRegistry__factory.abi, types_1.UmamiAssetVaultRegistry__factory.bytecode, []);
    const registry = await (0, dolomite_utils_1.createContractWithAbi)(types_1.RegistryProxy__factory.abi, types_1.RegistryProxy__factory.bytecode, await (0, umami_1.getUmamiAssetVaultRegistryConstructorParams)(core, implementation));
    return types_1.UmamiAssetVaultRegistry__factory.connect(registry.address, core.hhUser1);
}
exports.createUmamiAssetVaultRegistry = createUmamiAssetVaultRegistry;
function createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.UmamiAssetVaultIsolationModeWrapperTraderV2__factory.abi, types_1.UmamiAssetVaultIsolationModeWrapperTraderV2__factory.bytecode, (0, umami_1.getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams)(core, umamiAssetVaultRegistry, dUmamiAssetVaultToken));
}
exports.createUmamiAssetVaultIsolationModeWrapperTraderV2 = createUmamiAssetVaultIsolationModeWrapperTraderV2;
