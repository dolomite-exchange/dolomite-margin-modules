import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from 'packages/base/test/utils/setup';
import { AdminExpirePosition, AdminExpirePosition__factory, AdminRegistry } from '../src/types';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const usdcAmount = BigNumber.from('100000000');
const daiAmount = parseEther('100');
const expirationTimestamp = BigNumber.from('1777900000');

describe('AdminExpirePosition', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let adminExpirePosition: AdminExpirePosition;
  let adminRegistry: AdminRegistry;

  let account1: AccountInfoStruct;
  let account2: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 459_300_000,
    });

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.dai);

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

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.usdc,
      usdcAmount,
      BalanceCheckFlag.None
    );
    await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.dai,
      daiAmount,
      BalanceCheckFlag.None
    );

    await setupWETHBalance(core, core.hhUser2, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.usdc,
      usdcAmount,
      BalanceCheckFlag.None
    );
    await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.dai,
      daiAmount,
      BalanceCheckFlag.None
    );

    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(usdcAmount));
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(daiAmount).add(ONE_BI));
    await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(usdcAmount));
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(daiAmount).add(ONE_BI));

    account1 = { owner: core.hhUser1.address, number: borrowAccountNumber };
    account2 = { owner: core.hhUser2.address, number: borrowAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminExpirePosition.EXPIRY()).to.equal(core.expiry.address);
      expect(await adminExpirePosition.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminExpirePosition.ADMIN_REGISTRY()).to.equal(adminRegistry.address);
    });
  });

  describe('#expirePositions', () => {
    it('should work normally with 1 position with 1 market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        }
      ];
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
    });

    it('should work normally with 1 position and multiple markets', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        }
      ];
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account1, core.marketIds.dai)).to.eq(expirationTimestamp);
    });

    it('should work normally with multiple positions with 1 market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        },
        {
          expirationTimestamp,
          account: account2,
          owedMarkets: [core.marketIds.usdc],
        }
      ];
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.usdc)).to.eq(expirationTimestamp);
    });

    it('should work normally with multiple positions with multiple market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        },
        {
          expirationTimestamp,
          account: account2,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        }
      ];
      await adminExpirePosition.connect(core.gnosisSafe).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account1, core.marketIds.dai)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.dai)).to.eq(expirationTimestamp);
    });

    it('should fail if caller does not have permission', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        },
      ];
      await expectThrow(
        adminExpirePosition.connect(core.hhUser1).expirePositions(positions),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
