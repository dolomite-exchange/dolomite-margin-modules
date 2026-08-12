import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';

const FLOOR_PRICE_START_TIMESTAMP = 1786406400; // August 11, 2026 @ 00:00:00 UTC

/**
 * This script encodes the following transactions:
 * - Upgrade the vester to include the floor price of 3 cents
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const vesterV2Address = await deployContractAndSave(
    'VeExternalVesterImplementationV2',
    [
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address,
      await core.tokenomics.veExternalVester.PAIR_TOKEN(), // dolo
      await core.tokenomics.veExternalVester.PAIR_MARKET_ID(),
      await core.tokenomics.veExternalVester.PAYMENT_TOKEN(), // usdc
      await core.tokenomics.veExternalVester.PAYMENT_MARKET_ID(),
      await core.tokenomics.veExternalVester.REWARD_TOKEN(), // dolo
      await core.tokenomics.veExternalVester.REWARD_MARKET_ID(),
      FLOOR_PRICE_START_TIMESTAMP
    ],
    'VeExternalVesterImplementationV9',
  );

  const transactions: EncodedTransaction[] = [];

  // Upgrade the vester contract
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'veExternalVesterProxy',
      'upgradeTo',
      [vesterV2Address],
    ),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
