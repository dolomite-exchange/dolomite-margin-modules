import { parseEther } from 'ethers/lib/utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployBerachainPOLSystem } from 'packages/deployment/src/utils/deploy-utils';
import { encodeAddPOLIsolationModeMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';

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
    'pol-rUsd',
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
      TargetCollateralization._120, // @follow-up adjust
      TargetLiquidationPenalty._6, // adjust
      parseEther(`${2_000}`), // adjust
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
      // assertHardhatInvariant(
      //   (await core.dolomiteMargin.getMarketTokenAddress(iBgtMarketId)) === ibgtFactory.address,
      //   'Invalid iBgt market ID',
      // );
      // assertHardhatInvariant(
      //   (await registry.iBgtIsolationModeVaultFactory()) === ibgtFactory.address,
      //   'Invalid iBgt isolation mode vault factory',
      // );
    },
  };
}

doDryRunAndCheckDeployment(main);
