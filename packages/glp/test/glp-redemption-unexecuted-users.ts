import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { readFileSync } from 'fs';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectProtocolWeiBalanceChange, expectProtocolWeiBalanceChangeWithRoundingError } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupNativeUSDCBalance } from 'packages/base/test/utils/setup';
import { ModuleDeployments } from 'packages/deployment/src/utils';
import {
  GLPRedemptionOperator,
  GLPRedemptionOperator__factory,
} from 'packages/glp/src/types';

const UNEXECUTED_USERS_PATH = `${__dirname}/../unexecuted-users.json`;
const ALL_USERS_PATH = `${__dirname}/../glp-snapshot-holders-block-355880236.json`;
const HANDLER_ADDRESS = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

const allUsers = JSON.parse(readFileSync(ALL_USERS_PATH).toString()) as any[];
const unexecutedUsers = JSON.parse(readFileSync(UNEXECUTED_USERS_PATH).toString()) as any[];

/**
 * Users I manually removed from the list:
 * 
 * - 0x52bb0d2213502a51d05f4f7dbf6d0cc8c1a97083
 */

describe('glp-redemption-unexecuted-users', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let redemptionOperator: GLPRedemptionOperator;

  before(async () => {
    hre.tracer.enabled = false;
    core = await setupCoreProtocol({
      blockNumber: 411_697_800,
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);

    redemptionOperator = GLPRedemptionOperator__factory.connect(
      ModuleDeployments.GLPRedemptionOperatorV1[core.network].address,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#script', () => {
    it('should get users who still have unexecuted redemptions', async () => {
      const unexecutedUsers = [];
      for (const user of allUsers) {
        const userAddress = user['address'];
        const vaultAddress = await core.gmxEcosystem.live.dGlp.getVaultByAccount(userAddress);
        const usdcRedemptionAmount = await redemptionOperator.usdcRedemptionAmount(vaultAddress, '0');

        if (usdcRedemptionAmount.gt(ZERO_BI)) {
          unexecutedUsers.push({
            user: userAddress,
            vaultAddress: vaultAddress,
            usdcRedemptionAmount: usdcRedemptionAmount.toString(),
          });
        }
      }
    });

    it('should get sum of unexecuted users', async () => {
      let sum = ZERO_BI;
      for (const user of unexecutedUsers) {
        const usdcRedemptionAmount = BigNumber.from(user['usdcRedemptionAmount']);
        sum = sum.add(usdcRedemptionAmount);
      } 
      console.log('sum: ', sum.toString());
    });

    it('should work normally', async () => {
      const handlerImpersonator = await impersonate(HANDLER_ADDRESS, true);
      console.log(await core.dolomiteMargin.getAccountWei({ owner: handlerImpersonator.address, number: 0 }, core.marketIds.usdc));
      console.log(await core.dolomiteMargin.getAccountWei({ owner: handlerImpersonator.address, number: 0 }, core.marketIds.nativeUsdc));

      for (const user of unexecutedUsers) {
        expect((await redemptionOperator.usdcRedemptionAmount(user['vaultAddress'], '0')).toString()).to.eq(user['usdcRedemptionAmount']);

        const redemptionParams = [];
        redemptionParams.push({
          accountNumber: '0',
          outputMarketId: core.marketIds.link,
          minOutputAmountWei: ONE_BI,
        });

        hre.tracer.enabled = true;
        const tx = await redemptionOperator.connect(handlerImpersonator).handlerExecuteVault(user['vaultAddress'], redemptionParams, { gasLimit: 10000000 });
        hre.tracer.enabled = false;
        console.log(await core.dolomiteMargin.getAccountWei({ owner: handlerImpersonator.address, number: 0 }, core.marketIds.usdc));
        console.log(await core.dolomiteMargin.getAccountWei({ owner: handlerImpersonator.address, number: 0 }, core.marketIds.nativeUsdc));
        await expectProtocolWeiBalanceChangeWithRoundingError(core, tx, user['user'], 0, core.marketIds.usdc, user['usdcRedemptionAmount']);
        console.log(`Executed redemption for ${user['user']}`);
      }
    });
  });
});
