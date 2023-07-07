"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlutusVaultGLPIsolationModeWrapperTraderV2 = exports.createPlutusVaultGLPIsolationModeWrapperTraderV1 = exports.createPlutusVaultRegistry = exports.createPlutusVaultGLPIsolationModeUnwrapperTraderV2 = exports.createPlutusVaultGLPIsolationModeUnwrapperTraderV1 = exports.createPlutusVaultGLPPriceOracle = exports.createPlutusVaultGLPIsolationModeTokenVaultV1 = exports.createPlutusVaultGLPIsolationModeVaultFactory = exports.createDolomiteCompatibleWhitelistForPlutusDAO = void 0;
const types_1 = require("../../../src/types");
const plutus_1 = require("../../../src/utils/constructors/plutus");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
function createDolomiteCompatibleWhitelistForPlutusDAO(core, unwrapperTrader, wrapperTrader, plutusWhitelist, dplvGlpToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.DolomiteCompatibleWhitelistForPlutusDAO__factory.abi, types_1.DolomiteCompatibleWhitelistForPlutusDAO__factory.bytecode, (0, plutus_1.getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams)(core, unwrapperTrader, wrapperTrader, plutusWhitelist, dplvGlpToken));
}
exports.createDolomiteCompatibleWhitelistForPlutusDAO = createDolomiteCompatibleWhitelistForPlutusDAO;
function createPlutusVaultGLPIsolationModeVaultFactory(core, plutusVaultRegistry, plvGlpToken, userVaultImplementation) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeVaultFactory__factory.abi, types_1.PlutusVaultGLPIsolationModeVaultFactory__factory.bytecode, (0, plutus_1.getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams)(core, plutusVaultRegistry, plvGlpToken, userVaultImplementation));
}
exports.createPlutusVaultGLPIsolationModeVaultFactory = createPlutusVaultGLPIsolationModeVaultFactory;
function createPlutusVaultGLPIsolationModeTokenVaultV1() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeTokenVaultV1__factory.abi, types_1.PlutusVaultGLPIsolationModeTokenVaultV1__factory.bytecode, []);
}
exports.createPlutusVaultGLPIsolationModeTokenVaultV1 = createPlutusVaultGLPIsolationModeTokenVaultV1;
function createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, dplvGlpToken, unwrapper) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPPriceOracle__factory.abi, types_1.PlutusVaultGLPPriceOracle__factory.bytecode, (0, plutus_1.getPlutusVaultGLPPriceOracleConstructorParams)(core, plutusVaultRegistry, dplvGlpToken, unwrapper));
}
exports.createPlutusVaultGLPPriceOracle = createPlutusVaultGLPPriceOracle;
function createPlutusVaultGLPIsolationModeUnwrapperTraderV1(core, plutusVaultRegistry, dPlvGlpToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.abi, types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.bytecode, (0, plutus_1.getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams)(core, plutusVaultRegistry, dPlvGlpToken));
}
exports.createPlutusVaultGLPIsolationModeUnwrapperTraderV1 = createPlutusVaultGLPIsolationModeUnwrapperTraderV1;
function createPlutusVaultGLPIsolationModeUnwrapperTraderV2(core, plutusVaultRegistry, dPlvGlpToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.abi, types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.bytecode, (0, plutus_1.getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams)(core, plutusVaultRegistry, dPlvGlpToken));
}
exports.createPlutusVaultGLPIsolationModeUnwrapperTraderV2 = createPlutusVaultGLPIsolationModeUnwrapperTraderV2;
function createPlutusVaultRegistry(core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultRegistry__factory.abi, types_1.PlutusVaultRegistry__factory.bytecode, (0, plutus_1.getPlutusVaultRegistryConstructorParams)(core));
}
exports.createPlutusVaultRegistry = createPlutusVaultRegistry;
function createPlutusVaultGLPIsolationModeWrapperTraderV1(core, plutusVaultRegistry, dPlvGlpToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeWrapperTraderV1__factory.abi, types_1.PlutusVaultGLPIsolationModeWrapperTraderV1__factory.bytecode, (0, plutus_1.getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams)(core, plutusVaultRegistry, dPlvGlpToken));
}
exports.createPlutusVaultGLPIsolationModeWrapperTraderV1 = createPlutusVaultGLPIsolationModeWrapperTraderV1;
function createPlutusVaultGLPIsolationModeWrapperTraderV2(core, plutusVaultRegistry, dPlvGlpToken) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.PlutusVaultGLPIsolationModeWrapperTraderV2__factory.abi, types_1.PlutusVaultGLPIsolationModeWrapperTraderV2__factory.bytecode, (0, plutus_1.getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams)(core, plutusVaultRegistry, dPlvGlpToken));
}
exports.createPlutusVaultGLPIsolationModeWrapperTraderV2 = createPlutusVaultGLPIsolationModeWrapperTraderV2;
