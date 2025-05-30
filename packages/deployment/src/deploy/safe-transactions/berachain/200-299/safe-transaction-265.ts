import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set initial addresses and amounts for vesting contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const remappings = await import('../../../ecosystems/helpers/airdrop/airdrop-mappings.json');
  const remappingData = remappings.remappings2;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'regularAirdrop',
      'ownerSetAddressRemapping',
      [
        remappingData.map((r) => r.newUserAddress),
        remappingData.map((r) => r.oldUserAddress),
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [
        remappingData.map((r) => r.newUserAddress),
        remappingData.map((r) => r.oldUserAddress),
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
