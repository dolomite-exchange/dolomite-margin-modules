import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import MimBorrowers from './mim-borrowers.json';
import {
  IAdminExpirePosition,
} from '@dolomite-exchange/modules-admin/src/types/contracts/interfaces/IAdminExpirePosition';
import { encodeExpirePositions } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Expire all debt with MIM
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const expirationTimestamp = Math.floor((Date.now() + (30 * 60 * 1_000)) / 1_000);

  const borrowers: IAdminExpirePosition.ExpirePositionParamsStruct[] = [];
  for (const { id } of MimBorrowers) {
    const [user, accountNumber] = id.split('-');
    const account = {
      owner: user,
      number: accountNumber,
    };
    try {
      const [supply, borrow] = await core.dolomiteMargin.getAdjustedAccountValues(account);
      if (supply.value.mul(ONE_ETH_BI).div(borrow.value).gt(parseEther('1.15'))) {
        borrowers.push({
          account,
          expirationTimestamp,
          owedMarkets: [core.marketIds.mim],
        });
      }
    } catch (e) {
      console.error(`Error getting account values for ${account.owner}-${account.number}: ${e}`);
    }
  }

  const cursor = 3;
  const transactions: EncodedTransaction[] = [
    await encodeExpirePositions(core, borrowers.slice(cursor * 30, (cursor + 1) * 30)),
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
      await printPriceForVisualCheck(core, core.tokens.mim);
    },
  };
}

doDryRunAndCheckDeployment(main);
