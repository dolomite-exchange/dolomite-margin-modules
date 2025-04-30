import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const OPTION_AIRDROP_MERKLE_ROOT = '0xea62ba20f90986e03792f67bdd49d0b63f4895c413aacc52110f92aed8df1d3e';
const REGULAR_AIRDROP_MERKLE_ROOT = '0x40c2944667a515db4f206498e199c149602bd65a817ac59dc47bfeb38ded6294';

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

  const optionAirdrop = core.tokenomicsAirdrop.optionAirdrop;
  const regularAirdrop = core.tokenomicsAirdrop.regularAirdrop;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { optionAirdrop }, 'optionAirdrop', 'ownerSetMerkleRoot', [
      OPTION_AIRDROP_MERKLE_ROOT,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { regularAirdrop }, 'regularAirdrop', 'ownerSetMerkleRoot', [
      REGULAR_AIRDROP_MERKLE_ROOT,
    ]),
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
