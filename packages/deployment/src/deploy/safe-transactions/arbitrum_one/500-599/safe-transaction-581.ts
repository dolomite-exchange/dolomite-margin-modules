import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { expectProtocolBalanceIsGreaterThan } from '../../../../../../base/test/utils/assertions';
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

  const accounts = [
    {
      owner: '0xec0f08bc015a0d0fba1df0b8b11d4779f5a04326',
      number: '83739606014428120693479726400323499703449033428325717469693567927919900459359',
    },
    {
      owner: '0xec0f08bc015a0d0fba1df0b8b11d4779f5a04326',
      number: '41151503422338736178515563136745814916286501924411901014410917272325291445221',
    },
  ];
  const goArb = core.liquidityMiningEcosystem.goARB;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, goArb, 'goArbVester', 'ownerUpgradeForShutdownPart2', []),
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
    invariants: async () => {
      await expectProtocolBalanceIsGreaterThan(core, accounts[0], core.marketIds.nativeUsdc, parseUsdc(`${7_519}`), 1);
      await expectProtocolBalanceIsGreaterThan(core, accounts[1], core.marketIds.nativeUsdc, parseUsdc(`${4_479}`), 1);
    },
  };
}

doDryRunAndCheckDeployment(main);
