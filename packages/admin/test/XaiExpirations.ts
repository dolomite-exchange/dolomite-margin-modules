import axios from 'axios';
import {
  createContractWithAbi,
} from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminExpirePosition, AdminExpirePosition__factory, AdminRegistry } from '../src/types';
import { expect } from 'chai';

const BORROW_EXPIRATION_TIMESTAMP = 1779321600;
const SUPPLY_EXPIRATION_TIMESTAMP = 1779341600;

describe('XaiExpirations', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let adminExpirePosition: AdminExpirePosition;
  let adminRegistry: AdminRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 459_300_000,
    });

    adminRegistry = await createAdminRegistry(core);
    adminExpirePosition = await createContractWithAbi<AdminExpirePosition>(
      AdminExpirePosition__factory.abi,
      AdminExpirePosition__factory.bytecode,
      [core.expiry.address, adminRegistry.address, core.dolomiteMargin.address],
    );

    await core.dolomiteMargin.ownerSetGlobalOperator(adminExpirePosition.address, true);
    await adminRegistry.connect(core.governance).grantPermission(
      adminExpirePosition.interface.getSighash('expirePositions'),
      adminExpirePosition.address,
      core.gnosisSafe.address,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#xaiExpirations', () => {
    it('should work normally', async () => {
      const positions = [];

      const supplyAccounts = await axios
        .post(
          'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
          { query: supplyQuery },
        )
        .then((response) => response.data.data.marginAccounts)
        .catch((error) => {
          console.log(error);
          throw(error);
        });
      const borrowAccounts = await axios
        .post(
          'https://api.goldsky.com/api/public/project_clyuw4gvq4d5801tegx0aafpu/subgraphs/dolomite-arbitrum/latest/gn',
          { query: borrowQuery },
        )
        .then((response) => response.data.data.marginAccounts)
        .catch((error) => {
          console.log(error);
          throw(error);
        });

      for (const borrowAccount of borrowAccounts) {
        if (borrowAccount.user.id === '0xb39d9d81ce88aa1679f0570af6e452d50358ea3f') {
          continue; // user is vaporizable with less than 1 cent of debt
        }

        positions.push({
          account: { owner: borrowAccount.user.id, number: borrowAccount.accountNumber },
          owedMarkets: [core.marketIds.xai],
          expirationTimestamp: BORROW_EXPIRATION_TIMESTAMP
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
          expirationTimestamp: SUPPLY_EXPIRATION_TIMESTAMP
        });
      }

      // loop through supply accounts
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      for (const borrowAccount of borrowAccounts) {
        if (borrowAccount.user.id === '0xb39d9d81ce88aa1679f0570af6e452d50358ea3f') {
          continue; // user is vaporizable with less than 1 cent of debt
        }

        expect(await core.expiry.getExpiry(
          { owner: borrowAccount.user.id, number: borrowAccount.accountNumber },
          core.marketIds.xai
        )).to.eq(BORROW_EXPIRATION_TIMESTAMP);
      }

      for (const supplyAccount of supplyAccounts) {
        if (supplyAccount.user.id === '0x9834a1d62116ad16b4bbdd832f9ecfcc89871d38') {
          continue; // user is unhealthy with less than 1 cent of collateral and debt
        }

        for (const token of supplyAccount.tokenValues) {
          if (token.valuePar.startsWith('-')) {
            expect(await core.expiry.getExpiry(
              { owner: supplyAccount.user.id, number: supplyAccount.accountNumber },
              token.token.marketId
            )).to.eq(SUPPLY_EXPIRATION_TIMESTAMP);
          }
        }
      }
    });
  });
});

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