import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  getMagicGLPPriceOracleConstructorParams,
  getMagicGLPUnwrapperTraderV1ConstructorParams,
  getMagicGLPWrapperTraderV1ConstructorParams,
} from '../../src/utils/constructors/abracadabra';
import { getAndCheckSpecificNetwork } from '../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';

async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const magicGlpPriceOracle = await deployContractAndSave(
    Number(network),
    'MagicGLPPriceOracle',
    getMagicGLPPriceOracleConstructorParams(core),
  );
  const unwrapperTraderAddress = await deployContractAndSave(
    Number(network),
    'MagicGLPUnwrapperTraderV1',
    getMagicGLPUnwrapperTraderV1ConstructorParams(core),
  );
  await deployContractAndSave(
    Number(network),
    'MagicGLPWrapperTraderV1',
    getMagicGLPWrapperTraderV1ConstructorParams(core),
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerAddMarket(
      core.abraEcosystem!.magicGlp.address,
      magicGlpPriceOracle,
      core.interestSetters.alwaysZeroInterestSetter.address,
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
      unwrapperTraderAddress,
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
