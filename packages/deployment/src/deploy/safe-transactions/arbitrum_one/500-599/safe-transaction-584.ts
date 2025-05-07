import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { GravitaExternalVesterImplementationV2__factory } from 'packages/liquidity-mining/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Execute final for goARB (2/2)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const implementationAddress = await deployContractAndSave(
    'GravitaExternalVesterImplementationV2',
    [
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address,
      core.tokens.nativeUsdc.address,
      core.tokens.nativeUsdc.address,
      core.tokens.arb.address,
    ],
    'GravitaExternalVesterImplementationV3',
  );
  const implementation = GravitaExternalVesterImplementationV2__factory.connect(implementationAddress, core.hhUser1);
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem.goARB,
      'goArbVesterProxy',
      'upgradeTo',
      [implementation.address],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
