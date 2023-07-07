"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const traders_1 = require("../src/utils/constructors/traders");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'ParaswapAggregatorTrader', (0, traders_1.getParaswapAggregatorTraderConstructorParams)(core));
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
