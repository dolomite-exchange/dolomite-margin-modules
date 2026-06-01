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

const BORROW_EXPIRATION_TIMESTAMP = Math.floor(Date.now() / 1000) + 420;
const SUPPLY_EXPIRATION_TIMESTAMP = Math.floor(Date.now() / 1000) + 420;
const SUBGRAPH_URL =
  'https://subgraph.api.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-arbitrum/latest/gn';

/**
 * This script encodes the following transactions:
 * - Expires all XAI holders and borrowers
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  const positions: IExpirePositionProxy.ExpirePositionParamsStruct[] = [];
  const supplyAccounts = await axios
    .post(SUBGRAPH_URL, { query: supplyQuery })
    .then((response) => response.data.data.marginAccounts)
    .catch((error) => {
      console.log(error);
      throw error;
    });
  const borrowAccounts = await axios
    .post(SUBGRAPH_URL, { query: borrowQuery })
    .then((response) => response.data.data.marginAccounts)
    .catch((error) => {
      console.log(error);
      throw error;
    });

  for (const borrowAccount of borrowAccounts) {
    if (borrowAccount.user.id === '0xb39d9d81ce88aa1679f0570af6e452d50358ea3f') {
      continue; // user is vaporizable with less than 1 cent of debt
    }

    positions.push({
      account: { owner: borrowAccount.user.id, number: borrowAccount.accountNumber },
      owedMarkets: [core.marketIds.xai],
      expirationTimestamp: BORROW_EXPIRATION_TIMESTAMP,
    });
  }

  for (const supplyAccount of supplyAccounts) {
    if (supplyAccount.user.id === '0x9834a1d62116ad16b4bbdd832f9ecfcc89871d38') {
      continue; // user is unhealthy with less than 1 cent of collateral and debt
    }

    const debtMarkets = [];
    for (const token of supplyAccount.tokenValues) {
      if (token.valuePar.startsWith('-')) {
        debtMarkets.push(token.token.marketId);
      }
    }

    positions.push({
      account: { owner: supplyAccount.user.id, number: supplyAccount.accountNumber },
      owedMarkets: debtMarkets,
      expirationTimestamp: SUPPLY_EXPIRATION_TIMESTAMP,
    });
  }

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
      for (const supplyAccount of supplyAccounts) {
        if (supplyAccount.user.id === '0x9834a1d62116ad16b4bbdd832f9ecfcc89871d38') {
          continue; // user is unhealthy with less than 1 cent of collateral and debt
        }

        for (const token of supplyAccount.tokenValues) {
          if (token.valuePar.startsWith('-')) {
            const account = { owner: supplyAccount.user.id, number: supplyAccount.accountNumber };
            assertHardhatInvariant(
              await core.expiry.getExpiry(account, token.token.marketId) === SUPPLY_EXPIRATION_TIMESTAMP,
              'Invalid supply expiration timestamps',
            );
          }
        }
      }

      for (const borrowAccount of borrowAccounts) {
        const account = { owner: borrowAccount.user.id, number: borrowAccount.accountNumber };
        assertHardhatInvariant(
          await core.expiry.getExpiry(account, core.marketIds.xai) === BORROW_EXPIRATION_TIMESTAMP,
          'Invalid borrow expiration timestamps',
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

const supplyQuery = `
  {
    marginAccounts(
      where: {supplyTokens_: {id: "0x4cb9a7ae498cedcbb5eae9f25736ae7d428c9d66"}}
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
const borrowQuery = `
  {
    marginAccounts(
      where: {borrowTokens_: {id: "0x4cb9a7ae498cedcbb5eae9f25736ae7d428c9d66"}}
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
