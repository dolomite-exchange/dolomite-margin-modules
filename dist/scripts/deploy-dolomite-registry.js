"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const types_1 = require("../src/types");
const dolomite_1 = require("../src/utils/constructors/dolomite");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const implementationAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'DolomiteRegistryImplementation', []);
    const implementation = types_1.DolomiteRegistryImplementation__factory.connect(implementationAddress, core.hhUser1);
    const calldata = await implementation.populateTransaction.initialize(core.genericTraderProxy.address);
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'RegistryProxy', (0, dolomite_1.getRegistryProxyConstructorParams)(implementationAddress, calldata.data, core), 'DolomiteRegistryProxy');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
