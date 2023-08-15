import { ethers } from 'hardhat';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';
import { getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/jones';
import { CHAINLINK_REGISTRY_MAP } from '../../src/utils/constants';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const jonesUSDCWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'JonesUSDCWithChainlinkAutomationPriceOracle',
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      CHAINLINK_REGISTRY_MAP[network],
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory
    )
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(
      core.marketIds.djUSDC!,
      jonesUSDCWithChainlinkAutomationPriceOracle
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
