"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoleAndWhitelistTrader = exports.TRADER_ROLE = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("../../../utils");
exports.TRADER_ROLE = ethers_1.ethers.utils.solidityKeccak256(['uint256'], [Date.now()]);
async function createRoleAndWhitelistTrader(core, unwrapper, wrapper) {
    const owner = await (0, utils_1.impersonate)(await core.jonesEcosystem.whitelistController.owner(), true);
    await core.jonesEcosystem.whitelistController.connect(owner).createRole(exports.TRADER_ROLE, {
        jGLP_BYPASS_CAP: true,
        jUSDC_BYPASS_TIME: true,
        jGLP_RETENTION: '30000000000',
        jUSDC_RETENTION: '9700000000',
    });
    await core.jonesEcosystem.whitelistController.connect(owner).addToRole(exports.TRADER_ROLE, unwrapper.address);
    await core.jonesEcosystem.whitelistController.connect(owner).addToWhitelistContracts(unwrapper.address);
    await core.jonesEcosystem.whitelistController.connect(owner).addToWhitelistContracts(wrapper.address);
}
exports.createRoleAndWhitelistTrader = createRoleAndWhitelistTrader;
