"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.gmxEcosystem.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(core.gmxEcosystem.live.glpIsolationModeUnwrapperTraderV1.address, false), 'glpIsolationModeFactory.setIsTokenConverterTrusted(unwrapper, false)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.gmxEcosystem.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(core.gmxEcosystem.live.glpIsolationModeWrapperTraderV1.address, false), 'glpIsolationModeFactory.setIsTokenConverterTrusted(wrapper, false)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(core.marketIds.dfsGlp, core.liquidatorProxyV3.address), 'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dfsGlp, liquidatorProxyV3)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(core.plutusEcosystem.live.plvGlpIsolationModeUnwrapperTraderV1.address, false), 'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(unwrapper, false)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(core.plutusEcosystem.live.plvGlpIsolationModeWrapperTraderV1.address, false), 'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(wrapper, false)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(core.marketIds.dplvGlp, core.liquidatorProxyV3.address), 'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dplvGlp, liquidatorProxyV3)');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
