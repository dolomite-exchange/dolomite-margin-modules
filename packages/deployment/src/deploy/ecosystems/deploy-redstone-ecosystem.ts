import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave, EncodedTransaction, TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { getChroniclePriceOracleConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { CHRONICLE_PRICE_SCRIBES_MAP, REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import getScriptName from '../../utils/get-script-name';
import { DryRunOutput } from '../../utils/dry-run-utils';

async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const scribeMap = REDSTONE_PRICE_AGGREGATORS_MAP[network];
  const tokens = Object.keys(scribeMap);
  const scribes = tokens.map(t => scribeMap[t]?.tokenPairAddress);
  const invertPrices = tokens.map(t => scribeMap[t].invertPrice ?? false);
  await deployContractAndSave(
    'RedstonePriceOracleV3',
    getChroniclePriceOracleConstructorParams(tokens, scribes, invertPrices, core),
  );

  const transactions: EncodedTransaction[] = [];

  return {
    core,
    invariants: async () => {
    },
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      meta: {
        name: 'Chronicle Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    }
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
