"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWhitelistAndAggregateVault = void 0;
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
async function setupWhitelistAndAggregateVault(core, umamiRegistry) {
    const aggregateVault = types_1.IUmamiAggregateVault__factory.connect(await core.umamiEcosystem.glpUsdc.connect(core.hhUser1).aggregateVault(), core.umamiEcosystem.configurator);
    await aggregateVault.connect(core.umamiEcosystem.configurator).setVaultCaps([
        no_deps_constants_1.MAX_UINT_256_BI,
        no_deps_constants_1.MAX_UINT_256_BI,
        no_deps_constants_1.MAX_UINT_256_BI,
        no_deps_constants_1.MAX_UINT_256_BI,
        no_deps_constants_1.MAX_UINT_256_BI,
    ]);
    const storageViewer = types_1.IUmamiAssetVaultStorageViewer__factory.connect(await umamiRegistry.storageViewer(), core.hhUser1);
    const vaultFees = await storageViewer.getVaultFees();
    await aggregateVault.connect(core.umamiEcosystem.configurator).setVaultFees(no_deps_constants_1.ZERO_BI, no_deps_constants_1.ZERO_BI, vaultFees.withdrawalFee, vaultFees.depositFee, no_deps_constants_1.ZERO_BI);
    const whitelist = types_1.IUmamiAssetVaultWhitelist__factory.connect(await storageViewer.getWhitelist(), core.umamiEcosystem.configurator);
    await whitelist.updateWhitelistEnabled(false);
}
exports.setupWhitelistAndAggregateVault = setupWhitelistAndAggregateVault;
