"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGmxRegistryConstructorParams = exports.getGLPWrapperTraderV2ConstructorParams = exports.getGLPWrapperTraderV1ConstructorParams = exports.getGLPIsolationModeVaultFactoryConstructorParams = exports.getGLPUnwrapperTraderV2ConstructorParams = exports.getGLPUnwrapperTraderV1ConstructorParams = exports.getGLPPriceOracleV1ConstructorParams = void 0;
function getGLPPriceOracleV1ConstructorParams(dfsGlp, gmxRegistry) {
    return [gmxRegistry.address, dfsGlp.address];
}
exports.getGLPPriceOracleV1ConstructorParams = getGLPPriceOracleV1ConstructorParams;
function getGLPUnwrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry) {
    return [
        core.tokens.usdc.address,
        gmxRegistry.address,
        dfsGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getGLPUnwrapperTraderV1ConstructorParams = getGLPUnwrapperTraderV1ConstructorParams;
function getGLPUnwrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry) {
    return [
        gmxRegistry.address,
        dfsGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getGLPUnwrapperTraderV2ConstructorParams = getGLPUnwrapperTraderV2ConstructorParams;
function getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation) {
    return [
        core.tokens.weth.address,
        core.marketIds.weth,
        gmxRegistry.address,
        core.gmxEcosystem.fsGlp.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ];
}
exports.getGLPIsolationModeVaultFactoryConstructorParams = getGLPIsolationModeVaultFactoryConstructorParams;
function getGLPWrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry) {
    return [
        core.tokens.usdc.address,
        gmxRegistry.address,
        dfsGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getGLPWrapperTraderV1ConstructorParams = getGLPWrapperTraderV1ConstructorParams;
function getGLPWrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry) {
    return [
        gmxRegistry.address,
        dfsGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getGLPWrapperTraderV2ConstructorParams = getGLPWrapperTraderV2ConstructorParams;
function getGmxRegistryConstructorParams(core) {
    if (!core.gmxEcosystem) {
        throw new Error('GMX ecosystem not initialized');
    }
    return [
        {
            esGmx: core.gmxEcosystem.esGmx.address,
            fsGlp: core.gmxEcosystem.fsGlp.address,
            glp: core.gmxEcosystem.glp.address,
            glpManager: core.gmxEcosystem.glpManager.address,
            glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
            gmx: core.gmxEcosystem.gmx.address,
            gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
            gmxVault: core.gmxEcosystem.gmxVault.address,
            sGlp: core.gmxEcosystem.sGlp.address,
            sGmx: core.gmxEcosystem.sGmx.address,
            sbfGmx: core.gmxEcosystem.sbfGmx.address,
            vGlp: core.gmxEcosystem.vGlp.address,
            vGmx: core.gmxEcosystem.vGmx.address,
        },
        core.dolomiteMargin.address,
    ];
}
exports.getGmxRegistryConstructorParams = getGmxRegistryConstructorParams;
