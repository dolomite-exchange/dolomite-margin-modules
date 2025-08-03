import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { deployBerachainPOLSystem } from 'packages/deployment/src/utils/deploy-utils';
import { encodeAddPOLIsolationModeMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsSingleCollateral,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys pol-rUsd POL Isolation Mode Ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const polRUsdMarketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];

  const rUsdSystem = await deployBerachainPOLSystem(
    core,
    core.berachainRewardsEcosystem.live.registry,
    core.dolomiteTokens.rUsd,
    'POLrUsd',
    core.berachainRewardsEcosystem.live.tokenVaultImplementation,
    core.berachainRewardsEcosystem.live.unwrapperImplementation,
    core.berachainRewardsEcosystem.live.wrapperImplementation,
  );

  transactions.push(
    ...(await encodeAddPOLIsolationModeMarket(
      core,
      rUsdSystem,
      core.oracleAggregatorV2,
      polRUsdMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8,
      parseEther(`${25_000_000}`),
    )),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      polRUsdMarketId,
      [
        {
          debtMarketIds: [core.marketIds.rUsd],
          marginRatioOverride: TargetCollateralization._107,
          liquidationRewardOverride: TargetLiquidationPenalty._2,
        }
      ]
    )
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
      expect(await rUsdSystem.factory.symbol()).to.eq('pol-rUSD');
      expect(await rUsdSystem.factory.name()).to.eq('Dolomite Isolation: pol-rUSD');
      await checkSupplyCap(core, polRUsdMarketId, parseEther(`${25_000_000}`));
      await checkAccountRiskOverrideIsSingleCollateral(
        core,
        polRUsdMarketId,
        [
          {
            debtMarketIds: [core.marketIds.rUsd],
            marginRatioOverride: TargetCollateralization._107,
            liquidationRewardOverride: TargetLiquidationPenalty._2,
          },
        ],
      );

      await printPriceForVisualCheck(core, rUsdSystem.factory);
    },
  };
}

doDryRunAndCheckDeployment(main);
