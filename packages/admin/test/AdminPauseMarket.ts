import { expect } from 'chai';
import { BigNumber, BytesLike } from 'ethers';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance } from 'packages/base/test/utils/setup';
import { AdminPauseMarket, AdminPauseMarket__factory } from '../src/types';

const usdcAmount = BigNumber.from('10000000'); // 10 USDC

describe('AdminPauseMarket', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let adminPauseMarket: AdminPauseMarket;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 3_389_300,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);

    const adminRegistry = await createAdminRegistry(core);
    adminPauseMarket = await createContractWithAbi<AdminPauseMarket>(
      AdminPauseMarket__factory.abi,
      AdminPauseMarket__factory.bytecode,
      [adminRegistry.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();
    const adminPauseMarketRole = await adminPauseMarket.ADMIN_PAUSE_MARKET_ROLE();

    dolomiteOwnerImpersonator = await impersonate(core.ownerAdapterV2.address, true);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).ownerAddRole(adminPauseMarketRole);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(adminPauseMarketRole, adminPauseMarket.address);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(bypassTimelockRole, adminPauseMarket.address);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).grantRole(executorRole, adminPauseMarket.address);

    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .ownerAddRoleToAddressFunctionSelectors(adminPauseMarketRole, core.dolomiteMargin.address, [
        core.dolomiteMargin.interface.getSighash(core.dolomiteMargin.interface.getFunction('ownerSetPriceOracle')),
      ]);

    await adminRegistry.connect(core.governance).grantPermission(
      adminPauseMarket.interface.getSighash('pauseMarket'),
      adminPauseMarket.address,
      core.gnosisSafe.address
    );
    await adminRegistry.connect(core.governance).grantPermission(
      adminPauseMarket.interface.getSighash('unpauseMarket'),
      adminPauseMarket.address,
      core.gnosisSafe.address
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminPauseMarket.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await adminPauseMarket.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#pauseMarket', () => {
    it('should work normally to pause a market', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      const res = await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      await expectEvent(adminPauseMarket, res, 'SetMarketPaused', { marketId: core.marketIds.usdc, isPaused: true });
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>',
      );
      await expectThrow(
        withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>',
      );

      const res2 = await adminPauseMarket
        .connect(core.gnosisSafe)
        .unpauseMarket(core.marketIds.usdc, core.oracleAggregatorV2.address);
      await expectEvent(adminPauseMarket, res2, 'SetMarketPaused', { marketId: core.marketIds.usdc, isPaused: false });
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(false);
      await withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if already paused', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc),
        'AdminPauseMarket: Market is already paused',
      );
    });

    it('should fail if the sender is not a trusted caller', async () => {
      await expectThrow(
        adminPauseMarket.connect(core.hhUser1).pauseMarket(core.marketIds.usdc),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#unpauseMarket', () => {
    it('should work normally to unpause a market', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(true);

      const res = await adminPauseMarket
        .connect(core.gnosisSafe)
        .unpauseMarket(core.marketIds.usdc, core.oracleAggregatorV2.address);
      await expectEvent(adminPauseMarket, res, 'SetMarketPaused', { marketId: core.marketIds.usdc, isPaused: false });
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(false);
    });

    it('should fail if token is not paused', async () => {
      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(core.marketIds.usdc, core.oracleAggregatorV2.address),
        'AdminPauseMarket: Invalid parameters',
      );
    });

    it('should fail if price oracle is zero address', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(core.marketIds.usdc, ADDRESS_ZERO),
        'AdminPauseMarket: Invalid parameters',
      );
    });

    it('should fail if the sender is not a trusted caller', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.isTokenPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.hhUser1).unpauseMarket(core.marketIds.usdc, core.oracleAggregatorV2.address),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.addressLower}>`,
      );
    });
  });
});
