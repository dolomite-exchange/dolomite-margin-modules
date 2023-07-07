"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const types_1 = require("src/types");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const jones_1 = require("../src/utils/constructors/jones");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const jonesUsdcRegistryAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCRegistry', (0, jones_1.getJonesUSDCRegistryConstructorParams)(core));
    const jonesUsdcRegistry = types_1.JonesUSDCRegistry__factory.connect(jonesUsdcRegistryAddress, core.hhUser1);
    const userVaultImplementationAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCIsolationModeTokenVaultV1', []);
    const userVaultImplementation = types_1.JonesUSDCIsolationModeTokenVaultV1__factory.connect(userVaultImplementationAddress, core.hhUser1);
    const djUSDCTokenAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCIsolationModeVaultFactory', (0, jones_1.getJonesUSDCIsolationModeVaultFactoryConstructorParams)(core, jonesUsdcRegistry, core.jonesEcosystem.jUSDC, userVaultImplementation));
    const djUSDCToken = types_1.JonesUSDCIsolationModeVaultFactory__factory.connect(djUSDCTokenAddress, core.hhUser1);
    const unwrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCIsolationModeUnwrapperTraderV2', (0, jones_1.getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams)(core, jonesUsdcRegistry, djUSDCToken));
    const unwrapper = types_1.JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);
    const wrapperAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCIsolationModeWrapperTraderV2', (0, jones_1.getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams)(core, jonesUsdcRegistry, djUSDCToken));
    const wrapper = types_1.JonesUSDCIsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);
    const priceOracleAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'JonesUSDCPriceOracle', (0, jones_1.getJonesUSDCPriceOracleConstructorParams)(core, jonesUsdcRegistry, djUSDCToken));
    if ((await jonesUsdcRegistry.unwrapperTrader()) === dolomite_margin_1.ADDRESSES.ZERO) {
        console.log('Initializing unwrapper trader on JonesUSDCRegistry...');
        await jonesUsdcRegistry.initializeUnwrapperTrader(unwrapper.address);
    }
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerAddMarket(djUSDCToken.address, priceOracleAddress, core.alwaysZeroInterestSetter.address, { value: no_deps_constants_1.ZERO_BI }, // 115% collateralization
    { value: no_deps_constants_1.ZERO_BI }, ethers_1.BigNumber.from(500000).mul(no_deps_constants_1.TEN_BI.pow(await djUSDCToken.decimals())), // 500k units
    true, false), 'dolomiteMargin.ownerAddMarket');
    await (0, deploy_utils_1.prettyPrintEncodedData)(djUSDCToken.populateTransaction.ownerInitialize([unwrapper.address, wrapper.address]), 'djUSDCToken.ownerInitialize');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetGlobalOperator(djUSDCToken.address, true), 'dolomiteMargin.ownerSetGlobalOperator');
    const expectedMarketId = 10;
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(expectedMarketId, core.liquidatorProxyV4.address), 'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
