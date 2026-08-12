import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseUnits } from 'ethers/lib/utils';
import { IAlgebraV3Pool__factory } from 'packages/oracles/src/types';
import { IERC20Metadata__factory } from '../../../../../../base/src/types';
import { OHM_HONEY_POOL_MAP } from '../../../../../../base/src/utils/constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertTwapV3Oracle, } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Switch to TWAP for OHM
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const ohmDecimals = await IERC20Metadata__factory.connect(core.tokens.ohm.address, core.hhUser1).decimals();
  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapV3Oracle(core, core.tokens.ohm, {
      tokenPool: IAlgebraV3Pool__factory.connect(OHM_HONEY_POOL_MAP[network], core.hhUser1),
      observationInterval: 1_800,
      tokenPair: core.tokens.honey,
      minPrice: parseUnits(`${9}`, 36 - ohmDecimals),
      maxPrice: parseUnits(`${36}`, 36 - ohmDecimals),
    })),
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
      await printPriceForVisualCheck(core, core.tokens.ohm);
    },
  };
}

doDryRunAndCheckDeployment(main);
