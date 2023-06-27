import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import { setupCoreProtocol } from '../test/utils/setup';
import { prettyPrintEncodedData } from './deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(
      core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1.address,
      false,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(unwrapper, false)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(
      core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1.address,
      false,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(wrapper, false)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry!.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dfsGlp!,
      core.liquidatorProxyV3!.address,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dfsGlp, liquidatorProxyV3)',
  );

  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      core.plutusEcosystem!.live.plvGlpIsolationModeUnwrapperTraderV1.address,
      false,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(unwrapper, false)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      core.plutusEcosystem!.live.plvGlpIsolationModeWrapperTraderV1.address,
      false,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(wrapper, false)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry!.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dplvGlp!,
      core.liquidatorProxyV3!.address,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dplvGlp, liquidatorProxyV3)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
