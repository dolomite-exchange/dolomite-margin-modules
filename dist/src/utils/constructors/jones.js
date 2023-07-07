"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams = exports.getJonesUSDCIsolationModeVaultFactoryConstructorParams = exports.getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams = exports.getJonesUSDCPriceOracleConstructorParams = exports.getJonesUSDCRegistryConstructorParams = void 0;
const no_deps_constants_1 = require("../no-deps-constants");
function getJonesUSDCRegistryConstructorParams(core) {
    if (!core.jonesEcosystem) {
        throw new Error('Jones ecosystem not initialized');
    }
    return [
        core.jonesEcosystem.glpAdapter.address,
        core.jonesEcosystem.glpVaultRouter.address,
        core.jonesEcosystem.whitelistController.address,
        core.jonesEcosystem.usdcReceiptToken.address,
        core.jonesEcosystem.jUSDC.address,
        core.dolomiteMargin.address,
    ];
}
exports.getJonesUSDCRegistryConstructorParams = getJonesUSDCRegistryConstructorParams;
function getJonesUSDCPriceOracleConstructorParams(core, jonesUSDCRegistry, djUSDCToken) {
    if (!core.jonesEcosystem) {
        throw new Error('Jones ecosystem not initialized');
    }
    return [
        core.dolomiteMargin.address,
        jonesUSDCRegistry.address,
        core.marketIds.usdc,
        djUSDCToken.address,
    ];
}
exports.getJonesUSDCPriceOracleConstructorParams = getJonesUSDCPriceOracleConstructorParams;
function getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams(core, jonesUSDCRegistry, djUSDCToken) {
    if (!core.jonesEcosystem) {
        throw new Error('Jones ecosystem not initialized');
    }
    return [
        core.liquidatorAssetRegistry.address,
        core.tokens.usdc.address,
        jonesUSDCRegistry.address,
        djUSDCToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams = getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams;
function getJonesUSDCIsolationModeVaultFactoryConstructorParams(core, jonesUSDCRegistry, jUSDCToken, userVaultImplementation) {
    if (!core.jonesEcosystem) {
        throw new Error('Jones ecosystem not initialized');
    }
    return [
        jonesUSDCRegistry.address,
        [core.marketIds.usdc],
        [no_deps_constants_1.NONE_MARKET_ID],
        jUSDCToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ];
}
exports.getJonesUSDCIsolationModeVaultFactoryConstructorParams = getJonesUSDCIsolationModeVaultFactoryConstructorParams;
function getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(core, jonesUSDCRegistry, djUSDCToken) {
    if (!core.jonesEcosystem) {
        throw new Error('Jones ecosystem not initialized');
    }
    return [
        core.tokens.usdc.address,
        jonesUSDCRegistry.address,
        djUSDCToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams = getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams;
