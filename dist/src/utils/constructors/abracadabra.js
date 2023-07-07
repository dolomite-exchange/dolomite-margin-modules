"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMagicGLPWrapperTraderV2ConstructorParams = exports.getMagicGLPWrapperTraderV1ConstructorParams = exports.getMagicGLPUnwrapperTraderV2ConstructorParams = exports.getMagicGLPUnwrapperTraderV1ConstructorParams = exports.getMagicGLPPriceOracleConstructorParams = void 0;
function getMagicGLPPriceOracleConstructorParams(core) {
    return [
        core.dolomiteMargin.address,
        core.abraEcosystem.magicGlp.address,
        core.marketIds.dfsGlp,
    ];
}
exports.getMagicGLPPriceOracleConstructorParams = getMagicGLPPriceOracleConstructorParams;
function getMagicGLPUnwrapperTraderV1ConstructorParams(core) {
    if (!core.abraEcosystem) {
        throw new Error('Abra ecosystem not initialized');
    }
    return [
        core.abraEcosystem.magicGlp.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        core.marketIds.usdc,
        core.dolomiteMargin.address,
    ];
}
exports.getMagicGLPUnwrapperTraderV1ConstructorParams = getMagicGLPUnwrapperTraderV1ConstructorParams;
function getMagicGLPUnwrapperTraderV2ConstructorParams(core) {
    if (!core.abraEcosystem) {
        throw new Error('Abra ecosystem not initialized');
    }
    return [
        core.abraEcosystem.magicGlp.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        core.dolomiteMargin.address,
    ];
}
exports.getMagicGLPUnwrapperTraderV2ConstructorParams = getMagicGLPUnwrapperTraderV2ConstructorParams;
function getMagicGLPWrapperTraderV1ConstructorParams(core) {
    if (!core.abraEcosystem) {
        throw new Error('Abra ecosystem not initialized');
    }
    return [
        core.abraEcosystem.magicGlp.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        core.dolomiteMargin.address,
    ];
}
exports.getMagicGLPWrapperTraderV1ConstructorParams = getMagicGLPWrapperTraderV1ConstructorParams;
function getMagicGLPWrapperTraderV2ConstructorParams(core) {
    if (!core.abraEcosystem) {
        throw new Error('Abra ecosystem not initialized');
    }
    return [
        core.abraEcosystem.magicGlp.address,
        core.gmxEcosystem.live.gmxRegistry.address,
        core.dolomiteMargin.address,
    ];
}
exports.getMagicGLPWrapperTraderV2ConstructorParams = getMagicGLPWrapperTraderV2ConstructorParams;
