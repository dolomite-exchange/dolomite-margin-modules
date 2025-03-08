import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';
import { DolomiteERC4626__factory } from 'packages/base/src/types';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const IBGT_WHALE_ADDRESS = '0x9b45388Fc442343dE9959D710eB47Da8c09eE2d9';
const amountWei = parseEther('.5');
const defaultAccountNumber = ZERO_BI;

describe('InfraredBGTIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let iBgtVaultImplementation: InfraredBGTIsolationModeTokenVaultV1;

  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_342_200,
      network: Network.Berachain,
    });

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    const iBgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.iBgt.connect(iBgtWhale).transfer(core.hhUser1.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await iBgtFactory.berachainRewardsRegistry()).to.equal(registry.address);
      expect(await iBgtFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.iBgt.address);
      expect(await iBgtFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await iBgtFactory.userVaultImplementation()).to.equal(iBgtVaultImplementation.address);
      expect(await iBgtFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#depositIntoDolomiteMarginFromMetaVault', () => {
    it('should work normally', async () => {
      await iBgtFactory.createVault(core.hhUser1.address);
      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await core.tokens.iBgt.connect(core.hhUser1).transfer(metaVaultImpersonator.address, amountWei);
      await core.tokens.iBgt.connect(metaVaultImpersonator).approve(iBgtVault.address, amountWei);

      await iBgtVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      await iBgtFactory
        .connect(metaVaultImpersonator)
        .depositIntoDolomiteMarginFromMetaVault(core.hhUser1.address, defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by owners metaVault', async () => {
      await expectThrow(
        iBgtFactory
          .connect(core.hhUser1)
          .depositIntoDolomiteMarginFromMetaVault(core.hhUser1.address, ZERO_BI, ONE_ETH_BI),
        'MetaVaultRewardReceiverFactory: Can only deposit from metaVault',
      );
    });
  });

  describe('#depositOtherTokenIntoDolomiteMarginFromMetaVault', () => {
    it('should work normally if vault exists', async () => {
      await iBgtFactory.createVault(core.hhUser1.address);
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await setupHONEYBalance(core, metaVaultImpersonator, amountWei, core.dolomiteMargin);

      await iBgtFactory
        .connect(metaVaultImpersonator)
        .depositOtherTokenIntoDolomiteMarginFromMetaVault(
          core.hhUser1.address,
          defaultAccountNumber,
          core.marketIds.honey,
          amountWei
        );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
    });

    it('should work normally if vault does not exist', async () => {
      // create POL vault so we can create metavault without iBgt vault
      const dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);
      const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
      const factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, parseEther('2000')); // same price as WETH
      await setupTestMarket(core, factory, true);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);
      await factory.createVault(core.hhUser1.address);

      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await setupHONEYBalance(core, metaVaultImpersonator, amountWei, core.dolomiteMargin);

      await iBgtFactory
        .connect(metaVaultImpersonator)
        .depositOtherTokenIntoDolomiteMarginFromMetaVault(
          core.hhUser1.address,
          defaultAccountNumber,
          core.marketIds.honey,
          amountWei
        );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
    });

    it('should fail if market id is factory market id', async () => {
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await expectThrow(
        iBgtFactory
          .connect(metaVaultImpersonator)
          .depositOtherTokenIntoDolomiteMarginFromMetaVault(
            core.hhUser1.address,
            defaultAccountNumber,
            iBgtMarketId,
            amountWei
          ),
        `MetaVaultRewardReceiverFactory: Invalid market <${iBgtMarketId.toString()}>`,
      );
    });

    it('should fail if not called by metavault', async () => {
      await expectThrow(
        iBgtFactory
          .connect(core.hhUser1)
          .depositOtherTokenIntoDolomiteMarginFromMetaVault(
            core.hhUser1.address,
            defaultAccountNumber,
            core.marketIds.honey,
            amountWei
          ),
        'MetaVaultRewardReceiverFactory: Can only deposit from metaVault',
      );
    });
  });

  describe('#ownerSetBerachainRewardsRegistry', () => {
    it('should work normally', async () => {
      const result = await iBgtFactory.connect(core.governance).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS);
      await expectEvent(iBgtFactory, result, 'BerachainRewardsRegistrySet', {
        berachainRewardsRegistry: OTHER_ADDRESS,
      });
      expect(await iBgtFactory.berachainRewardsRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        iBgtFactory.connect(core.hhUser1).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await iBgtFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await iBgtFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
