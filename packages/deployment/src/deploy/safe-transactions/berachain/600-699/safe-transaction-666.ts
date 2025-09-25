import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const BEARN_VAULT = '0xC82971BcFF09171e16Ac08AEE9f4EA3fB16C3BDC';
const BEARN_DEPLOYER = '0xBEA7400025a9d1319CE333B5822f92D45C309EA4';

/**
 * This script encodes the following transactions:
 * - Sets the remapped address for bearn oDolo
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { rollingClaims: core.tokenomics.rollingClaims },
      'rollingClaims',
      'ownerSetAddressRemapping',
      [[BEARN_DEPLOYER], [BEARN_VAULT]],
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
    invariants: async () => {
      assertHardhatInvariant(
        (await core.tokenomics.rollingClaims.addressRemapping(BEARN_DEPLOYER)) === BEARN_VAULT,
        'Bearn oDolo address remapping is incorrect',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
