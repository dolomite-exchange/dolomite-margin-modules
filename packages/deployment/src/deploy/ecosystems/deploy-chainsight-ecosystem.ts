import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, DolomiteNetwork } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CHAINSIGHT_KEYS_MAP } from 'packages/base/src/utils/constants';
import { getChainsightPriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { ChainsightPriceOracleV3__factory, IERC20__factory } from 'packages/oracles/src/types';
import { deployContractAndSave, TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { encodeInsertChainsightOracleV3 } from '../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../utils/invariant-utils';

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const rawNetwork = (await getAnyNetwork()) as T;
  if (rawNetwork !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network: ${rawNetwork}`));
  }
  const network = rawNetwork as Network.Berachain;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const chainsightAddress = await deployContractAndSave(
    'ChainsightPriceOracleV3',
    getChainsightPriceOracleV3ConstructorParams(core, [], [], []),
    'ChainsightPriceOracleV3',
  );
  (core as any).chainsightPriceOracleV3 = ChainsightPriceOracleV3__factory.connect(chainsightAddress, core.hhUser1);

  const tokens = Object.keys(CHAINSIGHT_KEYS_MAP[network]).map((t) => IERC20__factory.connect(t, core.hhUser1));
  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (CHAINSIGHT_KEYS_MAP[network][tokens[i].address]) {
      transactions.push(...(await encodeInsertChainsightOracleV3(core, tokens[i])));
    }
  }

  return {
    core: core as any,
    invariants: async () => {
      for (let i = 0; i < tokens.length; i++) {
        await printPriceForVisualCheck(core, tokens[i]);
      }
    },
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      meta: {
        name: 'Chainsight Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

doDryRunAndCheckDeployment(main);
