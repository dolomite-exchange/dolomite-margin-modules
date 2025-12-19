import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { readFileSync } from 'fs';
import { writeFile } from 'fs-extra';
import { GLPRedemptionOperator__factory } from 'packages/glp/src/types';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const UNEXECUTED_USERS_PATH = `${__dirname}/../../../../../../glp/unexecuted-users.json`;
const HANDLER_ADDRESS = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

/**
 * Executes GLP redemption for users with no margin accounts
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const allUsers = JSON.parse(readFileSync(UNEXECUTED_USERS_PATH).toString()) as any[];
  const redemptionOperator = GLPRedemptionOperator__factory.connect(
    ModuleDeployments.GLPRedemptionOperatorV1[network].address,
    core.hhUser1,
  );

  for (const user of allUsers) {
    if (user.isExecuted) {
      continue;
    }

    const redemptionParams = [];
    redemptionParams.push({
      accountNumber: '0',
      outputMarketId: core.marketIds.wbtc,
      minOutputAmountWei: ONE_BI,
    });
    console.log(`Executing redemption for ${user['user']}`);
    await redemptionOperator
      .connect(core.hhUser1)
      .handlerExecuteVault(user['vaultAddress'], redemptionParams, { gasLimit: 10_000_000 });
    user.isExecuted = true;
    await writeFile(UNEXECUTED_USERS_PATH, JSON.stringify(allUsers, null, 2));
    console.log(`Executed redemption for ${user['user']}`);
    console.log('');
  }

  const transactions: EncodedTransaction[] = [];

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
