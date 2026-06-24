import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { IExpirePositionProxy } from '../../../../../../base/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const EXPIRATION_TIMESTAMP = Math.floor(Date.now() / 1000) + 600;
const SUBGRAPH_URL =
  'https://subgraph.api.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-botanix/latest/gn';

/**
 * This script encodes the following transactions:
 * - Expires all borrowers
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  const positions: IExpirePositionProxy.ExpirePositionParamsStruct[] = [];
  const accounts = await axios
    .post(SUBGRAPH_URL, { query: supplyQuery })
    .then((response) => response.data.data.marginAccounts)
    .catch((error) => {
      console.log(error);
      throw error;
    });

  for (const account of accounts) {
    if (SKIP_ACCOUNTS.includes(account.user.id)) {
      continue;
    }
    const accountStruct = {
      owner: account.user.id,
      number: account.accountNumber,
    };
    const [supplyValue, borrowValue] = await core.dolomiteMargin.getAdjustedAccountValues(accountStruct);
    if (supplyValue.value.lt(borrowValue.value.mul(115).div(100))) {
      console.log(`\tSkipping account: ${account.id}`);
      continue; // user is unhealthy
    }

    const debtMarkets = [];
    for (const token of account.tokenValues) {
      if (token.valuePar.startsWith('-')) {
        debtMarkets.push(token.token.marketId);
      }
    }

    positions.push({
      account: { owner: account.user.id, number: account.accountNumber },
      owedMarkets: debtMarkets,
      expirationTimestamp: EXPIRATION_TIMESTAMP,
    });
  }

  console.log('\tPosition count:', positions.length);
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { adminExpirePosition: core.adminExpirePosition },
      'adminExpirePosition',
      'expirePositions',
      [positions],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
  );

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      // loop through borrow and supply, call expiry and check expiration timestamp
      for (const supplyAccount of accounts) {
        for (const token of supplyAccount.tokenValues) {
          if (token.valuePar.startsWith('-')) {
            const account = { owner: supplyAccount.user.id, number: supplyAccount.accountNumber };
            assertHardhatInvariant(
              (await core.expiry.getExpiry(account, token.token.marketId)) === EXPIRATION_TIMESTAMP,
              'Invalid expiration timestamp',
            );
          }
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

const supplyQuery = `
  {
    marginAccounts(
      where: { hasBorrowValue: true, hasExpiration: false}
      orderBy: id
      first: 1000
    ) {
      accountNumber
      id
      user {
        id
      }
      tokenValues {
        valuePar
        token {
          id
          name
          marketId
        }
      }
    }
  }
`;
