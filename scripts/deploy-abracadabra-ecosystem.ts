import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { Network, ZERO_BI } from 'src/utils/no-deps-constants';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  await deployContractAndSave(Number(network), 'MagicGLPPriceOracle', [
    core.dolomiteMargin.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ]);
  await deployContractAndSave(Number(network), 'MagicGLPUnwrapperTrader', [
    core.abraEcosystem!.magicGlp.address,
    core.gmxRegistry!.address,
    core.marketIds.usdc,
    core.dolomiteMargin.address,
  ]);
  await deployContractAndSave(Number(network), 'MagicGLPWrapperTrader', [
    core.abraEcosystem!.magicGlp.address,
    core.gmxRegistry!.address,
    core.dolomiteMargin.address,
  ]);

  const deploymentsJson = require('./deployments.json');
  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      core.abraEcosystem!.magicGlp.address,
      deploymentsJson.MagicGLPPriceOracle[network].address,
      core.alwaysZeroInterestSetter.address,
      { value: BigNumber.from('43478260869565217') }, // 4.347% --> 120% collateralization
      { value: ZERO_BI },
      '5000000000000000000000000', // 5M units
      true,
      false,
    ),
    'dolomiteMargin.ownerAddMarket',
  );
  const expectedMagicGlpMarketId = await core.dolomiteMargin.getNumMarkets();
  await prettyPrintEncodedData(
    core.liquidatorProxyV3!.populateTransaction.setMarketIdToTokenUnwrapperForLiquidationMap(
      expectedMagicGlpMarketId,
      deploymentsJson.MagicGLPUnwrapperTrader[network].address,
    ),
    'liquidatorProxyV3.setMarketIdToTokenUnwrapperForLiquidationMap',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
