import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  MAX_UINT_112_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracleWithModifiers__factory } from 'packages/oracles/src/types';
import {
  DOLO_WBERA_KODIAK_POOL_MAP,
  HENLO_WBERA_POOL_MAP,
  IBERA_WBERA_KODIAK_POOL_MAP,
  IBGT_WBERA_KODIAK_POOL_MAP,
  KDK_USDT_KODIAK_POOL_MAP,
  WG_BERA_IBGT_KODIAK_POOL_MAP,
} from '../../../../../../base/src/utils/constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetIsBorrowOnly } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeInsertConstantPriceOracleV3,
  encodeInsertTwapV3Oracle,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

const THIRTY_MINS = 60 * 30;

/**
 * This script encodes the following transactions:
 * - Adjust oracles for some assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const twapPriceOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'KodiakTWAPPriceOracleV3WithModifiers',
  );
  (core as any).twapPriceOracleV3 = PancakeV3PriceOracleWithModifiers__factory.connect(
    twapPriceOracleAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.dolo, {
      tokenPool: IAlgebraV3Pool__factory.connect(DOLO_WBERA_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.001}`),
      maxPrice: parseEther(`${1_000}`),
      tokenPair: core.tokens.wbera,
    })),
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.henlo, {
      tokenPool: IAlgebraV3Pool__factory.connect(HENLO_WBERA_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: ONE_BI,
      maxPrice: MAX_UINT_112_BI.sub(1),
      tokenPair: core.tokens.wbera,
    })),
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.iBera, {
      tokenPool: IAlgebraV3Pool__factory.connect(IBERA_WBERA_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.8}`),
      maxPrice: parseEther(`${1.5}`),
      tokenPair: core.tokens.wbera,
    })),
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.iBgt, {
      tokenPool: IAlgebraV3Pool__factory.connect(IBGT_WBERA_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.8}`),
      maxPrice: parseEther(`${1.5}`),
      tokenPair: core.tokens.wbera,
    })),
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.wgBera, {
      tokenPool: IAlgebraV3Pool__factory.connect(WG_BERA_IBGT_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.75}`),
      maxPrice: parseEther(`${1.5}`),
      tokenPair: core.tokens.iBgt,
    })),
    ...(await encodeInsertTwapV3Oracle(core as any, core.tokens.kdk, {
      tokenPool: IAlgebraV3Pool__factory.connect(KDK_USDT_KODIAK_POOL_MAP[network], core.hhUser1),
      observationInterval: THIRTY_MINS, // 30 mins
      minPrice: parseEther(`${0.001}`),
      maxPrice: parseEther(`${1_000}`),
      tokenPair: core.tokens.usdt,
    })),
    ...(await encodeInsertConstantPriceOracleV3(core, core.tokens.diBgt, ONE_ETH_BI, core.tokens.iBgt.address)),
    await encodeSetIsBorrowOnly(core, core.marketIds.henlo, true),
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
      await printPriceForVisualCheck(core, core.tokens.henlo);
      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, core.tokens.diBgt);
      await printPriceForVisualCheck(core, core.tokens.wgBera);
      await printPriceForVisualCheck(core, core.tokens.kdk);
    },
  };
}

doDryRunAndCheckDeployment(main);
