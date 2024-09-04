import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployPendlePtSystem,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeInsertPendlePtOracle,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';


/**
 * This script encodes the following transactions:
 * - Sets up the PT-Mnt ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  const ptMntMarketId = numMarkets.add(incrementor++);

  const mntSystem = await deployPendlePtSystem(
    core,
    'MntOct2024',
    core.pendleEcosystem.mntOct2024.mntMarket,
    core.pendleEcosystem.mntOct2024.ptOracle,
    core.pendleEcosystem.mntOct2024.ptMntToken,
    core.pendleEcosystem.mntOct2024.syMntToken,
    core.tokens.wmnt,
  );

  transactions.push(
    await prettyPrintEncodeInsertPendlePtOracle(core, mntSystem, core.tokens.wmnt),
    ...(await prettyPrintEncodeAddIsolationModeMarket(
      core,
      mntSystem.factory,
      core.oracleAggregatorV2,
      mntSystem.unwrapper,
      mntSystem.wrapper,
      ptMntMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${1_000}`),
    )),
  );
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
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(ptMntMarketId)) === mntSystem.factory.address,
        'Invalid PT-mETH market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(ptMntMarketId)) === core.oracleAggregatorV2.address,
        'Invalid oracle for PT-mETH',
      );
      assertHardhatInvariant(
        await mntSystem.factory.isTokenConverterTrusted(mntSystem.unwrapper.address),
        'Unwrapper not trusted',
      );
      assertHardhatInvariant(
        await mntSystem.factory.isTokenConverterTrusted(mntSystem.wrapper.address),
        'Wrapper not trusted',
      );
      console.log('\tPrice for PT-mETH', (await core.dolomiteMargin.getMarketPrice(ptMntMarketId)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
