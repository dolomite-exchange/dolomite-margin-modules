"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const types_1 = require("../src/types");
const gmx_1 = require("../src/utils/constructors/gmx");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const chainId = (await hardhat_1.ethers.provider.getNetwork()).chainId;
    const core = await (0, setup_1.setupCoreProtocol)({ blockNumber: 0, network: chainId.toString() });
    const gmxRegistryAddress = await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GmxRegistryV1', (0, gmx_1.getGmxRegistryConstructorParams)(core));
    const gmxRegistry = types_1.IGmxRegistryV1__factory.connect(gmxRegistryAddress, core.hhUser1);
    const userVaultImplementationAddress = await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GLPIsolationModeTokenVaultV1', []);
    const userVaultImplementation = types_1.GLPIsolationModeTokenVaultV1__factory.connect(userVaultImplementationAddress, core.hhUser1);
    const factoryAddress = await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GLPIsolationModeVaultFactory', (0, gmx_1.getGLPIsolationModeVaultFactoryConstructorParams)(core, gmxRegistry, userVaultImplementation));
    const factory = types_1.IGLPIsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);
    await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GLPPriceOracleV1', (0, gmx_1.getGLPPriceOracleV1ConstructorParams)(factory, gmxRegistry));
    await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GLPIsolationModeWrapperTraderV1', (0, gmx_1.getGLPWrapperTraderV1ConstructorParams)(core, factory, gmxRegistry));
    await (0, deploy_utils_1.deployContractAndSave)(chainId, 'GLPIsolationModeUnwrapperTraderV1', (0, gmx_1.getGLPUnwrapperTraderV1ConstructorParams)(core, factory, gmxRegistry));
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
