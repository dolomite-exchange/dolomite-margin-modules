"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams = exports.getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams = exports.getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams = exports.getPendlePtGLP2024RegistryConstructorParams = exports.getPendlePtGLPPriceOracleConstructorParams = void 0;
function getPendlePtGLPPriceOracleConstructorParams(core, dptGlp, pendleRegistry) {
    if (!core.pendleEcosystem) {
        throw new Error('Pendle ecosystem not initialized');
    }
    return [
        dptGlp.address,
        pendleRegistry.address,
        core.dolomiteMargin.address,
        core.marketIds.dfsGlp,
    ];
}
exports.getPendlePtGLPPriceOracleConstructorParams = getPendlePtGLPPriceOracleConstructorParams;
function getPendlePtGLP2024RegistryConstructorParams(core) {
    if (!core.pendleEcosystem) {
        throw new Error('Pendle ecosystem not initialized');
    }
    return [
        core.pendleEcosystem.pendleRouter.address,
        core.pendleEcosystem.ptGlpMarket.address,
        core.pendleEcosystem.ptGlpToken.address,
        core.pendleEcosystem.ptOracle.address,
        core.pendleEcosystem.syGlpToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPendlePtGLP2024RegistryConstructorParams = getPendlePtGLP2024RegistryConstructorParams;
function getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry) {
    if (!core.pendleEcosystem) {
        throw new Error('Pendle ecosystem not initialized');
    }
    return [
        pendleRegistry.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        dptGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams = getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams;
function getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams(core, pendleRegistry, ptGlpToken, userVaultImplementation) {
    if (!core.pendleEcosystem) {
        throw new Error('Pendle ecosystem not initialized');
    }
    return [
        pendleRegistry.address,
        ptGlpToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams = getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams;
function getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry) {
    if (!core.pendleEcosystem) {
        throw new Error('Pendle ecosystem not initialized');
    }
    return [
        pendleRegistry.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        dptGlp.address,
        core.dolomiteMargin.address,
    ];
}
exports.getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams = getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams;
