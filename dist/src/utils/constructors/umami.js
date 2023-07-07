"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams = exports.getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams = exports.getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams = exports.getUmamiAssetVaultPriceOracleConstructorParams = exports.getUmamiAssetVaultRegistryConstructorParams = void 0;
const no_deps_constants_1 = require("../no-deps-constants");
async function getUmamiAssetVaultRegistryConstructorParams(core, implementation) {
    if (!core.umamiEcosystem) {
        throw new Error('Umami ecosystem not initialized');
    }
    const calldata = await implementation.populateTransaction.initialize(core.umamiEcosystem.storageViewer.address, core.dolomiteRegistry.address);
    return [
        implementation.address,
        core.dolomiteMargin.address,
        calldata.data,
    ];
}
exports.getUmamiAssetVaultRegistryConstructorParams = getUmamiAssetVaultRegistryConstructorParams;
function getUmamiAssetVaultPriceOracleConstructorParams(core, umamiAssetVaultRegistry, umamiVaultIsolationModeToken) {
    if (!core.umamiEcosystem) {
        throw new Error('Umami ecosystem not initialized');
    }
    return [
        core.dolomiteMargin.address,
        umamiAssetVaultRegistry.address,
        umamiVaultIsolationModeToken.address,
    ];
}
exports.getUmamiAssetVaultPriceOracleConstructorParams = getUmamiAssetVaultPriceOracleConstructorParams;
function getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams(core, umamiAssetVaultRegistry, umamiVaultIsolationModeToken) {
    if (!core.umamiEcosystem) {
        throw new Error('Umami ecosystem not initialized');
    }
    return [
        umamiVaultIsolationModeToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams = getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams;
async function getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams(core, umamiAssetVaultRegistry, umamiVaultToken, underlyingTokenForUmamiVault, userVaultImplementation) {
    if (!core.umamiEcosystem) {
        return Promise.reject(new Error('Umami ecosystem not initialized'));
    }
    return [
        umamiAssetVaultRegistry.address,
        [await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingTokenForUmamiVault.address)],
        [no_deps_constants_1.NONE_MARKET_ID],
        umamiVaultToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ];
}
exports.getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams = getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams;
function getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams(core, umamiAssetVaultRegistry, umamiVaultIsolationModeToken) {
    if (!core.umamiEcosystem) {
        throw new Error('Umami ecosystem not initialized');
    }
    return [
        umamiVaultIsolationModeToken.address,
        core.dolomiteMargin.address,
    ];
}
exports.getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams = getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams;
