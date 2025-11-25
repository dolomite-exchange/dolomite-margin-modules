import { expect } from 'chai';
import { BigNumber, BytesLike } from 'ethers';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from 'packages/base/test/utils/setup';
import { AdminForceWithdraw, AdminForceWithdraw__factory, AdminPauseMarket, AdminPauseMarket__factory } from '../src/types';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { ethers } from 'hardhat';

const gracePeriod = 1000;

const usdcAmount = BigNumber.from('10000000'); // 10 USDC
const wethAmount = ONE_ETH_BI;

const defaultAccountNumber = BigNumber.from('0');
const borrowAccountNumber = BigNumber.from('123');

describe('AdminForceWithdraw', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let adminForceWithdraw: AdminForceWithdraw;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 13_397_900,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    const adminRegistry = await createAdminRegistry(core);
    adminForceWithdraw = await createContractWithAbi<AdminForceWithdraw>(
      AdminForceWithdraw__factory.abi,
      AdminForceWithdraw__factory.bytecode,
      [1000, core.expiry.address, adminRegistry.address, core.dolomiteMargin.address],
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);

    await adminRegistry.connect(core.governance).grantPermission(
      adminForceWithdraw.interface.getSighash('forceWithdraw'),
      adminForceWithdraw.address,
      core.hhUser5.address
    );

    await core.dolomiteMargin.ownerSetGlobalOperator(adminForceWithdraw.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminForceWithdraw.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetGracePeriod', () => {
    it('should work normally', async () => {
      const res = await adminForceWithdraw.connect(core.governance).ownerSetGracePeriod(1000);
      await expectEvent(adminForceWithdraw, res, 'GracePeriodSet', {
        _gracePeriod: 1000,
      });
      expect(await adminForceWithdraw.gracePeriod()).to.equal(1000);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        adminForceWithdraw.connect(core.hhUser1).ownerSetGracePeriod(1000),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if grace period is 0', async () => {
      await expectThrow(
        adminForceWithdraw.connect(core.governance).ownerSetGracePeriod(0),
        'AdminForceWithdraw: Invalid grace period',
      );
    });
  });

  describe('#forceWithdraw', () => {
    it('should work normally is user has no debt and 1 market', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await adminForceWithdraw.connect(core.hhUser5).forceWithdraw(
        { owner: core.hhUser1.address, number: defaultAccountNumber }
      );
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
    });

    it('should work normally is user has no debt and 2 markets', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      
      await adminForceWithdraw.connect(core.hhUser5).forceWithdraw(
        { owner: core.hhUser1.address, number: defaultAccountNumber }
      );
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1, core.tokens.weth, wethAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    });

    it('should expire the position if user has 1 debt market', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await adminForceWithdraw.connect(core.hhUser5).forceWithdraw(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );

      const expiryTime = await getBlockTimestamp(await ethers.provider.getBlockNumber()) + gracePeriod;
      expect(await core.expiry.getExpiry(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.usdc,
      )).to.equal(expiryTime);
    });

    it('should set the expiration of the position if user has 2 debt markets', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdt,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await adminForceWithdraw.connect(core.hhUser5).forceWithdraw(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        { gasLimit: 5_000_000 }
      );

      const expiryTime = await getBlockTimestamp(await ethers.provider.getBlockNumber()) + gracePeriod;
      expect(await core.expiry.getExpiry(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.usdc,
      )).to.equal(expiryTime);
      expect(await core.expiry.getExpiry(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.usdt,
      )).to.equal(expiryTime);
    });

    it('should fail if not called by approved caller', async () => {
      await expectThrow(
        adminForceWithdraw.connect(core.hhUser1).forceWithdraw(
          { owner: core.hhUser1.address, number: borrowAccountNumber },
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});