import { getOogaBoogaAggregatorTraderConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/traders';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork<T>();
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  if (core.network !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  await deployContractAndSave('OogaBoogaAggregatorTrader', getOogaBoogaAggregatorTraderConstructorParams(core));

  return {
    core: core as any,
    invariants: async () => {},
    scriptName: getScriptName(__filename),
    upload: {
      transactions: [],
      chainId: network,
      meta: {
        name: 'Ooga Booga Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

doDryRunAndCheckDeployment(main);
