import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupNativeUSDCBalance } from 'packages/base/test/utils/setup';
import {
  GLPRedemptionOperator,
  GLPRedemptionOperator__factory,
} from 'packages/glp/src/types';

const USDC_REDEMPTION_AMOUNT = BigNumber.from('23815570107');
const PLV_GLP_SUPPLIED_AMOUNT = BigNumber.from('86508778219424211603124');
const defaultAccountNumber = ZERO_BI;

describe('plv-glp-redemption-script', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 382_895_500,
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.wbtc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#script', () => {
    it('should work normally', async () => {
      /**
       * Set the redemption amounts for all users
       */

      // get all users with balance at block number
      const url = 'https://api.dolomite.io/balances/42161/9?blockNumber=355880236';
      const response = await fetch(url);
      const data = await response.json();

      console.log(await core.dolomiteMargin.getMarketTotalPar(core.marketIds.dplvGlp, { blockTag: 355880236 }));

      for (const user of data['Result']) {
        // get user full reward amount
        const effectiveBalance = parseEther(user['effective_balance']);

        const fullRewardAmount = effectiveBalance.mul(USDC_REDEMPTION_AMOUNT).div(PLV_GLP_SUPPLIED_AMOUNT);

        if (user['address'] === '0x0f687b1d213aefb1c174cd8c136cdf563f2a7897') {
          console.log('fullRewardAmount: ', fullRewardAmount.toString());
        }
      }
    });
  });
});
