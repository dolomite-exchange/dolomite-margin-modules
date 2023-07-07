"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const types_1 = require("src/types");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const pendle_1 = require("../src/utils/constructors/pendle");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const pendleRegistryAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLP2024Registry', (0, pendle_1.getPendlePtGLP2024RegistryConstructorParams)(core));
    const pendleRegistry = types_1.PendlePtGLP2024Registry__factory.connect(pendleRegistryAddress, core.hhUser1);
    const userVaultImplementationAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLP2024IsolationModeTokenVaultV1', []);
    const userVaultImplementation = types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory.connect(userVaultImplementationAddress, core.hhUser1);
    const dptGlpTokenAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLP2024IsolationModeVaultFactory', (0, pendle_1.getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams)(core, pendleRegistry, core.pendleEcosystem.ptGlpToken, userVaultImplementation));
    const dptGlpToken = types_1.PendlePtGLP2024IsolationModeVaultFactory__factory.connect(dptGlpTokenAddress, core.hhUser1);
    const unwrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLP2024IsolationModeUnwrapperTraderV2', (0, pendle_1.getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams)(core, dptGlpToken, pendleRegistry));
    const unwrapper = types_1.PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);
    const wrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLP2024IsolationModeWrapperTraderV2', (0, pendle_1.getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams)(core, dptGlpToken, pendleRegistry));
    const wrapper = types_1.PendlePtGLP2024IsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);
    const priceOracleAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PendlePtGLPPriceOracle', (0, pendle_1.getPendlePtGLPPriceOracleConstructorParams)(core, dptGlpToken, pendleRegistry));
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerAddMarket(dptGlpToken.address, priceOracleAddress, core.alwaysZeroInterestSetter.address, { value: ethers_1.BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
    { value: no_deps_constants_1.ZERO_BI }, ethers_1.BigNumber.from(500000).mul(no_deps_constants_1.TEN_BI.pow(await dptGlpToken.decimals())), // 500k units
    true, false), 'dolomiteMargin.ownerAddMarket');
    await (0, deploy_utils_1.prettyPrintEncodedData)(dptGlpToken.populateTransaction.ownerInitialize([unwrapper.address, wrapper.address]), 'dptGlpToken.ownerInitialize');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(dptGlpToken.address, true), 'dolomiteMargin.ownerSetGlobalOperator');
    const expectedMarketId = 11; // deploy this after jUSDC
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(expectedMarketId, core.liquidatorProxyV4.address), 'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
