import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, THIRTY_MINS_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { IAlgebraV3Pool__factory } from 'packages/oracles/src/types';
import { TestPriceOracleForAdmin__factory } from '../../../../../../base/src/types';
import { DOLO_WBERA_KODIAK_POOL_MAP } from '../../../../../../base/src/utils/constants';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertTwapV3Oracle, } from '../../../../utils/encoding/oracle-encoder-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Update the max price for DOLO
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const testPriceOracle = TestPriceOracleForAdmin__factory.connect(
    ModuleDeployments.TestPriceOracleForAdmin[network].address,
    core.hhUser1,
  );

  await encodeReportCard(core, [
    core.erc4626Oracle,
    testPriceOracle,
    core.constantPriceOracle,
    core.chroniclePriceOracleV3,
    core.chainlinkPriceOracleV3,
    core.redstonePriceOracleV3,
    core.twapPriceOracleV3,
  ]);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapV3Oracle(core, core.tokens.dolo, {
      tokenPool: IAlgebraV3Pool__factory.connect(DOLO_WBERA_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS_SECONDS,
      minPrice: parseEther(`${0.01}`),
      maxPrice: parseEther(`${0.5}`),
      tokenPair: core.tokens.wbera,
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
      await printPriceForVisualCheck(core, core.tokens.dolo);
    },
  };
}

doDryRunAndCheckDeployment(main);
