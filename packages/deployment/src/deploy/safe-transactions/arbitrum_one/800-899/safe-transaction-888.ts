import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { encodePauseMarket } from 'packages/deployment/src/utils/encoding/dolomite-margin-core-encoder-utils';
import { CamelotV3PriceOracleWithModifiers__factory, IAlgebraV3Pool__factory } from 'packages/oracles/src/types';
import { encodeInsertCamelotTwapV3Oracle } from 'packages/deployment/src/utils/encoding/oracle-encoder-utils';
import { GRAIL_USDC_V3_POOL_MAP, JONES_WETH_V3_POOL_MAP, PREMIA_WETH_V3_POOL_MAP } from 'packages/base/src/utils/constants';
import { parseEther } from 'ethers/lib/utils';
import { printPriceForVisualCheck } from 'packages/deployment/src/utils/invariant-utils';

const THIRTY_MINS = 60 * 30;

/**
 * This script encodes the following transactions:
 * - Deploys CamelotPriceOracleWithModifiers
 * - Pauses DPX
 * - Updates oracles for JONES, PREMIA, and GRAIL
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const camelotWithModifiersAddress = await deployContractAndSave(
    'CamelotV3PriceOracleWithModifiers',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'CamelotV3PriceOracleWithModifiersV1'
  );
  (core as any).camelotTwapPriceOracleV3 = CamelotV3PriceOracleWithModifiers__factory.connect(
    camelotWithModifiersAddress,
    core.hhUser1
  );

  const transactions: EncodedTransaction[] = [
    await encodePauseMarket(core, core.marketIds.dpx),
    ...(await encodeInsertCamelotTwapV3Oracle(core as any, core.tokens.jones, {
      tokenPool: IAlgebraV3Pool__factory.connect(JONES_WETH_V3_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS,
      minPrice: parseEther('0.00000001'), // @todo update these
      maxPrice: parseEther('1'),
      tokenPair: core.tokens.weth,
    })),
    ...(await encodeInsertCamelotTwapV3Oracle(core as any, core.tokens.premia, {
      tokenPool: IAlgebraV3Pool__factory.connect(PREMIA_WETH_V3_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS,
      minPrice: parseEther('0.00000001'), // @todo update these
      maxPrice: parseEther('1'),
      tokenPair: core.tokens.weth,
    })),
    ...(await encodeInsertCamelotTwapV3Oracle(core as any, core.tokens.grail, {
      tokenPool: IAlgebraV3Pool__factory.connect(GRAIL_USDC_V3_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS,
      minPrice: parseEther('35'), // @todo update these
      maxPrice: parseEther('55'),
      tokenPair: core.tokens.usdc, // @follow-up not sure if you want usdc or address zero here
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
      await printPriceForVisualCheck(core, core.tokens.dpx); // @follow-up Shouldn't this be zero after pausing?
      await printPriceForVisualCheck(core, core.tokens.jones);
      await printPriceForVisualCheck(core, core.tokens.premia);
      await printPriceForVisualCheck(core, core.tokens.grail);
    },
  };
}

doDryRunAndCheckDeployment(main);
