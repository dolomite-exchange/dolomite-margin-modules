import { ethers } from 'hardhat';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';
import {
  getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams
} from '../../src/utils/constructors/abracadabra';
import { CHAINLINK_REGISTRY_MAP } from '../../src/utils/constants';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const magicGLPWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'MagicGLPWithChainlinkAutomationPriceOracle',
    getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(core, CHAINLINK_REGISTRY_MAP[network])
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(
      core.marketIds.magicGlp!,
      magicGLPWithChainlinkAutomationPriceOracle
    ),
    'dolomiteMargin.ownerSetPriceOracle'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
