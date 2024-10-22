import {
  getParaswapAggregatorTraderConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/traders';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  const core = await setupCoreProtocol<T>({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  if (!('paraswapEcosystem' in core)) {
    return Promise.reject(new Error('Invalid network, need paraswapEcosystem'));
  }

  await deployContractAndSave(
    'ParaswapAggregatorTraderV2',
    getParaswapAggregatorTraderConstructorParams(core),
  );
  return {
    core,
    invariants: async () => {
    },
    scriptName: getScriptName(__filename),
    upload: {
      chainId: core.network,
      transactions: [],
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
