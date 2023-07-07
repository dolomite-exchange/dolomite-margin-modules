"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const abracadabra_1 = require("../src/utils/constructors/abracadabra");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const network = (await hardhat_1.ethers.provider.getNetwork()).chainId.toString();
    const core = await (0, setup_1.setupCoreProtocol)({ network, blockNumber: 0 });
    const magicGlpPriceOracle = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'MagicGLPPriceOracle', (0, abracadabra_1.getMagicGLPPriceOracleConstructorParams)(core));
    const unwrapperTraderAddress = await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'MagicGLPUnwrapperTraderV1', (0, abracadabra_1.getMagicGLPUnwrapperTraderV1ConstructorParams)(core));
    await (0, deploy_utils_1.deployContractAndSave)(Number(network), 'MagicGLPWrapperTraderV1', (0, abracadabra_1.getMagicGLPWrapperTraderV1ConstructorParams)(core));
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerAddMarket(core.abraEcosystem.magicGlp.address, magicGlpPriceOracle, core.alwaysZeroInterestSetter.address, { value: ethers_1.BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
    { value: no_deps_constants_1.ZERO_BI }, '5000000000000000000000000', // 5M units
    true, false), 'dolomiteMargin.ownerAddMarket');
    const expectedMagicGlpMarketId = await core.dolomiteMargin.getNumMarkets();
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.liquidatorProxyV3.populateTransaction.setMarketIdToTokenUnwrapperForLiquidationMap(expectedMagicGlpMarketId, unwrapperTraderAddress), 'liquidatorProxyV3.setMarketIdToTokenUnwrapperForLiquidationMap');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
