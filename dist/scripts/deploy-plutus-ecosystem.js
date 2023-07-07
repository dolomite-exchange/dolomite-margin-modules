"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const types_1 = require("src/types");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const setup_1 = require("../test/utils/setup");
const plutus_1 = require("../src/utils/constructors/plutus");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const plutusVaultRegistryAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultRegistry', (0, plutus_1.getPlutusVaultRegistryConstructorParams)(core));
    const plutusVaultRegistry = types_1.PlutusVaultRegistry__factory.connect(plutusVaultRegistryAddress, core.hhUser1);
    const userVaultImplementationAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeTokenVaultV1', []);
    const userVaultImplementation = types_1.PlutusVaultGLPIsolationModeTokenVaultV1__factory.connect(userVaultImplementationAddress, core.hhUser1);
    const dplvGlpTokenAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeVaultFactory', (0, plutus_1.getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams)(core, plutusVaultRegistry, core.plutusEcosystem.plvGlp, userVaultImplementation));
    const dplvGlpToken = types_1.PlutusVaultGLPIsolationModeVaultFactory__factory.connect(dplvGlpTokenAddress, core.hhUser1);
    const unwrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeUnwrapperTraderV1', (0, plutus_1.getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams)(core, plutusVaultRegistry, dplvGlpToken));
    const unwrapper = types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect(unwrapperAddress, core.hhUser1);
    const wrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPIsolationModeWrapperTraderV1', (0, plutus_1.getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams)(core, plutusVaultRegistry, dplvGlpToken));
    const wrapper = types_1.PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect(wrapperAddress, core.hhUser1);
    const priceOracleAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'PlutusVaultGLPPriceOracle', (0, plutus_1.getPlutusVaultGLPPriceOracleConstructorParams)(core, plutusVaultRegistry, dplvGlpToken, unwrapper));
    const farmWhitelist = await core.plutusEcosystem.plvGlpFarm.whitelist();
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'DolomiteCompatibleWhitelistForPlutusDAO', (0, plutus_1.getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams)(core, unwrapper, wrapper, farmWhitelist, dplvGlpToken), 'DolomiteWhitelistForPlutusChef');
    const routerWhitelist = await core.plutusEcosystem.plvGlpRouter.whitelist();
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'DolomiteCompatibleWhitelistForPlutusDAO', (0, plutus_1.getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams)(core, unwrapper, wrapper, routerWhitelist, dplvGlpToken), 'DolomiteWhitelistForGlpDepositorV2');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerAddMarket(dplvGlpToken.address, priceOracleAddress, core.alwaysZeroInterestSetter.address, { value: ethers_1.BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
    { value: no_deps_constants_1.ZERO_BI }, '5000000000000000000000000', // 5M units
    true, false), 'dolomiteMargin.ownerAddMarket');
    await (0, deploy_utils_1.prettyPrintEncodedData)(dplvGlpToken.populateTransaction.ownerInitialize([unwrapperAddress, wrapperAddress]), 'dplvGlpToken.ownerInitialize');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(dplvGlpToken.address, true), 'dolomiteMargin.ownerSetGlobalOperator');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorProxyV3.populateTransaction.setMarketIdToTokenUnwrapperForLiquidationMap(await core.dolomiteMargin.getNumMarkets(), unwrapperAddress), 'liquidatorProxyV3.setMarketIdToTokenUnwrapperForLiquidationMap');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
