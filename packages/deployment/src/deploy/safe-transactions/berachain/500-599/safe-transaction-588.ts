import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Updates dolomite registry
 * - Sets marketIdToDToken for all dolomite tokens
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const dolomiteRegistryImplementationV15Address = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV15',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registryProxy: core.dolomiteRegistryProxy },
      'registryProxy',
      'upgradeTo',
      [dolomiteRegistryImplementationV15Address],
    ),
  ];

  for (const token of core.dolomiteTokens.all) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry: core.dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetMarketIdToDToken',
        [(await token.marketId()), token.address],
      ),
    );
  }

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
      for (const token of core.dolomiteTokens.all) {
        const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(await token.asset());
        const dToken = await core.dolomiteRegistry.marketIdToDToken(marketId);
        assertHardhatInvariant(dToken === token.address, 'dToken does not match');
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
