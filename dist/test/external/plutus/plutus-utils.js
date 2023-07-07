"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAndSetPlutusVaultWhitelist = void 0;
const utils_1 = require("../../utils");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
async function createAndSetPlutusVaultWhitelist(core, routerOrFarm, unwrapperTrader, wrapperTrader, dplvGlpToken) {
    const plutusWhitelist = await routerOrFarm.connect(core.hhUser1).whitelist();
    const dolomiteWhitelist = await (0, plutus_1.createDolomiteCompatibleWhitelistForPlutusDAO)(core, unwrapperTrader, wrapperTrader, plutusWhitelist, dplvGlpToken);
    const owner = await (0, utils_1.impersonate)(await routerOrFarm.owner(), true);
    await routerOrFarm.connect(owner).setWhitelist(dolomiteWhitelist.address);
}
exports.createAndSetPlutusVaultWhitelist = createAndSetPlutusVaultWhitelist;
