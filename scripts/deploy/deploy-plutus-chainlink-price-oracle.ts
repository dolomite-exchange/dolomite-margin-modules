import { ethers } from 'hardhat';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../deploy-utils';
import { getPlutusVaultWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/plutus';
import { CHAINLINK_REGISTRY_MAP } from '../../src/utils/constants';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const plvWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'PlutusVaultWithChainlinkAutomationPriceOracle',
    getPlutusVaultWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      CHAINLINK_REGISTRY_MAP[network],
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      core.plutusEcosystem!.live.plvGlpIsolationModeUnwrapperTraderV1
    )
  );

  await prettyPrintEncodedData(
    core.dolomiteMargin.populateTransaction.ownerSetPriceOracle(
      core.marketIds.dplvGlp!,
      plvWithChainlinkAutomationPriceOracle
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
