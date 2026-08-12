import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeInsertChronicleOracleV3,
  encodeInsertTwapV3Oracle,
} from '../../../../utils/encoding/oracle-encoder-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import {
  IAlgebraV3Pool__factory,
  PancakeV3PriceOracleWithModifiers__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { UNISWAP_DOLO_USDC_V3_POOL_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const twapPriceOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'UniswapTWAPPriceOracleV3WithModifiersV1',
  );
  (core as any).twapPriceOracleV3 = PancakeV3PriceOracleWithModifiers__factory.connect(
    twapPriceOracleAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.srUsd, ONE_BI),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.stcUsd, 1_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.cUsd, 1_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.rUsd, 1_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.wsrUsd, 1_000_000),

    await encodeSetBorrowCapWithMagic(core, core.marketIds.cUsd, 900_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.rUsd, 900_000),

    await encodeSetIsCollateralOnly(core, core.marketIds.crv, true),

    ...(await encodeInsertChronicleOracleV3(core, core.tokens.wsrUsd)),
    ...(await encodeInsertTwapV3Oracle(core, core.tokens.dolo, {
      tokenPool: IAlgebraV3Pool__factory.connect(UNISWAP_DOLO_USDC_V3_POOL_MAP[core.network], core.hhUser1),
      observationInterval: 1_800,
      minPrice: parseEther(`${0.001}`), // $0.001
      maxPrice: parseEther(`${0.1}`), // $0.10
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

      const doloUsdcPrice = await core.twapPriceOracleV3.getPrice(core.tokens.dolo.address);
      console.log(`\tDOLO/USDC price: $${formatEther(doloUsdcPrice.value)}`);
    },
  };
}

doDryRunAndCheckDeployment(main);
