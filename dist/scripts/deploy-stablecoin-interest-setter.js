"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const setup_1 = require("../test/utils/setup");
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const chainId = (await hardhat_1.ethers.provider.getNetwork()).chainId;
    const core = await (0, setup_1.setupCoreProtocol)({ network: chainId.toString(), blockNumber: 0 });
    const lowerOptimal = ethers_1.BigNumber.from('60000000000000000');
    const upperOptimal = ethers_1.BigNumber.from('940000000000000000');
    const stablecoinLinearInterestSetter = await (0, deploy_utils_1.deployContractAndSave)(chainId, 'LinearStepFunctionInterestSetter', [lowerOptimal, upperOptimal], 'StablecoinLinearStepFunctionInterestSetter');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetInterestSetter(core.marketIds.usdc, stablecoinLinearInterestSetter), 'dolomiteMargin.ownerSetInterestSetter(usdc, stablecoinLinearInterestSetter)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetInterestSetter(core.marketIds.usdt, stablecoinLinearInterestSetter), 'dolomiteMargin.ownerSetInterestSetter(usdt, stablecoinLinearInterestSetter)');
    await (0, deploy_utils_1.prettyPrintEncodedData)(core.dolomiteMargin.populateTransaction.ownerSetInterestSetter(core.marketIds.dai, stablecoinLinearInterestSetter), 'dolomiteMargin.ownerSetInterestSetter(dai, stablecoinLinearInterestSetter)');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
