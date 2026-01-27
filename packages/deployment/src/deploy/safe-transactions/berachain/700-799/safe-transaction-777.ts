import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { readFileSync } from 'fs';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

const AIRDROP_PATH = `${__dirname}/../../../../../../berachain/infrared-vaults-airdrop.json`;
const AIRDROP_TOTAL = BigNumber.from('91871889479504686914997');

/**
 * This script encodes the following transactions:
 * - Transfers IR tokens to airdrop recipients
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const preBal = await core.tokens.ir.balanceOf(core.gnosisSafe.address);
  const allUsers = JSON.parse(readFileSync(AIRDROP_PATH).toString()) as any[];
  const transactions: EncodedTransaction[] = [];
  for (const user of allUsers) {
    if (user['airdrop_amount'] === '') {
      continue;
    }

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.tokens,
        'ir',
        'transfer',
        [user['owner'], user['airdrop_amount']],
        { skipWrappingCalldataInSubmitTransaction: true },
    ));
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
      assertHardhatInvariant(
        (await core.tokens.ir.balanceOf(core.gnosisSafe.address)).eq(preBal.sub(AIRDROP_TOTAL)),
        'IR balance is incorrect',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
