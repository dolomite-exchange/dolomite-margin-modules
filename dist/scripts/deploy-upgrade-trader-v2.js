"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const abracadabra_1 = require("../src/utils/constructors/abracadabra");
const gmx_1 = require("../src/utils/constructors/gmx");
const plutus_1 = require("../src/utils/constructors/plutus");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'MagicGLPUnwrapperTraderV2', (0, abracadabra_1.getMagicGLPUnwrapperTraderV2ConstructorParams)(core));
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'MagicGLPWrapperTraderV2', (0, abracadabra_1.getMagicGLPWrapperTraderV2ConstructorParams)(core));
    const glpTokenVaultAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'GLPIsolationModeTokenVaultV1', []);
    const glpUnwrapperV2Address = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'GLPIsolationModeUnwrapperTraderV2', (0, gmx_1.getGLPUnwrapperTraderV2ConstructorParams)(core, core.gmxEcosystem.live.glpIsolationModeFactory, core.gmxEcosystem.live.gmxRegistry));
    const glpWrapperV2Address = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'GLPIsolationModeWrapperTraderV2', (0, gmx_1.getGLPWrapperTraderV2ConstructorParams)(core, core.gmxEcosystem.live.glpIsolationModeFactory, core.gmxEcosystem.live.gmxRegistry));
    const plvGlpTokenVaultAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeTokenVaultV1', []);
    const plvGlpUnwrapperV2Address = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeUnwrapperTraderV2', (0, plutus_1.getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams)(core, core.plutusEcosystem.live.plutusVaultRegistry, core.plutusEcosystem.live.plvGlpIsolationModeFactory));
    const plvGlpWrapperV2Address = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeWrapperTraderV2', (0, plutus_1.getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams)(core, core.plutusEcosystem.live.plutusVaultRegistry, core.plutusEcosystem.live.plvGlpIsolationModeFactory));
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.gmxEcosystem.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(glpUnwrapperV2Address, true), 'glpIsolationModeFactory.setIsTokenConverterTrusted(glpUnwrapperV2, true)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.gmxEcosystem.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(glpWrapperV2Address, true), 'glpIsolationModeFactory.setIsTokenConverterTrusted(glpWrapperV2, true)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2Address, true), 'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2, true)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2Address, true), 'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2, true)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2Address), 'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2Address), 'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2Address), 'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2Address), 'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.gmxEcosystem.live.glpIsolationModeFactory.populateTransaction.setUserVaultImplementation(glpTokenVaultAddress), 'glpIsolationModeFactory.setUserVaultImplementation(glpTokenVault)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.plutusEcosystem.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetUserVaultImplementation(plvGlpTokenVaultAddress), 'plvGlpIsolationModeFactory.ownerSetUserVaultImplementation(plvGlpTokenVault)');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
