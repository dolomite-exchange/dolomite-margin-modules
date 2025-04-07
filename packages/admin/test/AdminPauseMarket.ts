import { expect } from 'chai';
import { BigNumber, BytesLike } from 'ethers';
import {
  ADDRESS_ZERO,
  Network,
} from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { AdminPauseMarket, AdminPauseMarket__factory, DolomiteOwnerV2 } from '../src/types';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi, depositIntoDolomiteMargin, withdrawFromDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';

const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
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
      blockNumber: 3_389_300
    });
    await disableInterestAccrual(core, core.marketIds.usdc);

    adminPauseMarket = await createContractWithAbi<AdminPauseMarket>(
      AdminPauseMarket__factory.abi,
      AdminPauseMarket__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

    dolomiteOwnerImpersonator = await impersonate(core.ownerAdapterV2.address, true);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).ownerAddRole(OTHER_ROLE);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).grantRole(OTHER_ROLE, adminPauseMarket.address);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).grantRole(
      bypassTimelockRole,
      adminPauseMarket.address
    );
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).grantRole(executorRole, adminPauseMarket.address);

    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      OTHER_ROLE,
      core.dolomiteMargin.address,
      [
        '0xe8e72f75' /* ownerSetPriceOracle */,
      ],
    );
    await adminPauseMarket.connect(dolomiteOwnerImpersonator).ownerSetTrustedCaller(core.gnosisSafe.address, true);

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

  describe('#ownerSetTrustedCaller', () => {
    it('should work normally', async () => {
      const res = await adminPauseMarket.connect(dolomiteOwnerImpersonator).ownerSetTrustedCaller(
        core.hhUser1.address,
        true
      );
      await expectEvent(adminPauseMarket, res, 'TrustedCallerSet',
        { trustedCaller: core.hhUser1.address, trusted: true }
      );
      expect(await adminPauseMarket.trustedCallers(core.hhUser1.address)).to.equal(true);
    });

    it('should fail if the trusted caller is the zero address', async () => {
      await expectThrow(
        adminPauseMarket.connect(dolomiteOwnerImpersonator).ownerSetTrustedCaller(ADDRESS_ZERO, true),
        'AdminPauseMarket: Caller is zero address'
      );
    });

    it('should fail if the sender is not the owner', async () => {
      await expectThrow(
        adminPauseMarket.connect(core.hhUser1).ownerSetTrustedCaller(core.hhUser1.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#pauseMarket', () => {
    it('should work normally to pause a market', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      const res = await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      await expectEvent(adminPauseMarket, res, 'MarketPaused', { marketId: core.marketIds.usdc });
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>'
      );
      await expectThrow(
        withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount),
        'Storage: Price cannot be zero <2>'
      );

      const res2 = await adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(
        core.marketIds.usdc,
        core.oracleAggregatorV2.address
      );
      await expectEvent(adminPauseMarket, res2, 'MarketUnpaused', { marketId: core.marketIds.usdc });
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(false);
      await withdrawFromDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if already paused', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc),
        'AdminPauseMarket: Market is already paused'
      );
    });

    it('should fail if the sender is not a trusted caller', async () => {
      await expectThrow(
        adminPauseMarket.connect(core.hhUser1).pauseMarket(core.marketIds.usdc),
        'AdminPauseMarket: Sender is not trusted caller'
      );
    });
  });

  describe('#unpauseMarket', () => {
    it('should work normally to unpause a market', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(true);

      const res = await adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(
        core.marketIds.usdc,
        core.oracleAggregatorV2.address
      );
      await expectEvent(adminPauseMarket, res, 'MarketUnpaused', { marketId: core.marketIds.usdc });
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(false);
    });

    it('should fail if token is not paused', async () => {
      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(
          core.marketIds.usdc,
          core.oracleAggregatorV2.address
        ),
        'AdminPauseMarket: Invalid parameters'
      );
    });

    it('should fail if price oracle is zero address', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.gnosisSafe).unpauseMarket(
          core.marketIds.usdc,
          ADDRESS_ZERO
        ),
        'AdminPauseMarket: Invalid parameters'
      );
    });

    it('should fail if the sender is not a trusted caller', async () => {
      await adminPauseMarket.connect(core.gnosisSafe).pauseMarket(core.marketIds.usdc);
      expect(await adminPauseMarket.tokenToPaused(core.tokens.usdc.address)).to.equal(true);

      await expectThrow(
        adminPauseMarket.connect(core.hhUser1).unpauseMarket(
          core.marketIds.usdc,
          core.oracleAggregatorV2.address
        ),
        'AdminPauseMarket: Sender is not trusted caller'
      );
    });
  });
});
