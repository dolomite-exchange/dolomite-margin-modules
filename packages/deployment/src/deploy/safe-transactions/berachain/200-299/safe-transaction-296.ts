import { expect } from 'chai';
import { DOLOMITE_DAO_GNOSIS_SAFE_MAP } from '../../../../../../base/src/utils/constants';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set the treasury to the DAO
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const treasuryAddress = DOLOMITE_DAO_GNOSIS_SAFE_MAP[network]!;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteRegistry', 'ownerSetTreasury', [treasuryAddress]),
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
      expect(await core.dolomiteRegistry.treasury()).to.eq(treasuryAddress);
    },
  };
}

doDryRunAndCheckDeployment(main);
