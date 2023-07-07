"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const constants_1 = require("../src/utils/constants");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const userVaultImplementation = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'SimpleIsolationModeTokenVaultV1', [], 'AtlasSIUserVaultV1');
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'SimpleIsolationModeTokenFactory', [
        [core.marketIds.usdc],
        [no_deps_constants_1.NONE_MARKET_ID],
        constants_1.ATLAS_SI_TOKEN_MAP[network],
        core.borrowPositionProxyV2.address,
        userVaultImplementation,
        core.dolomiteMargin.address,
    ], 'AtlasSIUserVaultFactory');
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'TestAdminPriceOracleV1', [core.dolomiteMargin.address]);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
