"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams = exports.getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams = exports.getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams = exports.getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams = exports.getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams = exports.getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams = exports.getPlutusVaultGLPPriceOracleConstructorParams = exports.getPlutusVaultRegistryConstructorParams = void 0;
function getPlutusVaultRegistryConstructorParams(core) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.plutusEcosystem.plsToken.address,
        core.plutusEcosystem.plvGlp.address,
        core.plutusEcosystem.plvGlpRouter.address,
        core.plutusEcosystem.plvGlpFarm.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultRegistryConstructorParams = getPlutusVaultRegistryConstructorParams;
function getPlutusVaultGLPPriceOracleConstructorParams(core, plutusVaultRegistry, dplvGlpToken, unwrapper) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.dolomiteMargin.address,
        core.marketIds.dfsGlp,
        dplvGlpToken.address,
        plutusVaultRegistry.address,
        unwrapper.address,
    ];
}
exports.getPlutusVaultGLPPriceOracleConstructorParams = getPlutusVaultGLPPriceOracleConstructorParams;
function getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.tokens.usdc.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        plutusVaultRegistry.address,
        dPlvGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams = getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams;
function getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.gmxEcosystem.live.gmxRegistry.address,
        plutusVaultRegistry.address,
        dPlvGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams = getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams;
function getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(core, unwrapperTrader, wrapperTrader, plutusWhitelist, dplvGlpToken) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        unwrapperTrader.address,
        wrapperTrader.address,
        plutusWhitelist,
        dplvGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams = getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams;
function getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams(core, plutusVaultRegistry, plvGlpToken, userVaultImplementation) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        plutusVaultRegistry.address,
        plvGlpToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams = getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams;
function getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.gmxEcosystem.live.gmxRegistry.address,
        plutusVaultRegistry.address,
        dPlvGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams = getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams;
function getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken) {
    if (!core.plutusEcosystem) {
        throw new Error('Plutus ecosystem not initialized');
    }
    return [
        core.gmxEcosystem.live.gmxRegistry.address,
        plutusVaultRegistry.address,
        dPlvGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams = getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams;
