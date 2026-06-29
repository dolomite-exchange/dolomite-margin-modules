import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  Network,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracleWithModifiers__factory } from 'packages/oracles/src/types';
import {
  DOLO_USDC_UNISWAP_V3_POOL_MAP,
} from '../../../../../../base/src/utils/constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeInsertTwapV3Oracle,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

const THIRTY_MINS = 60 * 30;

/**
 * This script encodes the following transactions:
 * - Adjust oracles for DOLO
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const twapPriceOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'UniswapTWAPPriceOracleV3WithModifiers',
  );
  (core as any).twapPriceOracleV3 = PancakeV3PriceOracleWithModifiers__factory.connect(
    twapPriceOracleAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.dolo, {
      tokenPool: IAlgebraV3Pool__factory.connect(DOLO_USDC_UNISWAP_V3_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.01}`), // @todo adjust these
      maxPrice: parseEther(`${0.05}`),
      tokenPair: core.tokens.usdc,
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
