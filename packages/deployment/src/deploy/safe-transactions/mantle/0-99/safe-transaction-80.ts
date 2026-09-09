import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkPrice } from 'packages/deployment/src/utils/invariant-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { BTC_PLACEHOLDER_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { IERC20__factory } from '@dolomite-exchange/modules-base/src/types';

/**
 * This script encodes the following transactions:
 * - Set CMETH price oracle
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const btc = IERC20__factory.connect(BTC_PLACEHOLDER_MAP[Network.Mantle].address, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChainlinkOracleV3(core, btc, undefined, undefined, undefined, { ignoreDescription: true })),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.fbtc)),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      await checkPrice(core, core.tokens.fbtc);
    },
  };
}

doDryRunAndCheckDeployment(main);
