import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  IERC20,
  TestDolomiteERC4626,
} from '@dolomite-exchange/modules-base/src/types';
import {
  ADDRESS_ZERO,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  TWO_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createDolomiteErc4626Proxy } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  BGTIsolationModeVaultFactory,
  BGTMERC20Wrapper,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeTokenVaultV1,
  BGTMIsolationModeTokenVaultV1__factory,
  BGTMIsolationModeVaultFactory,
  IInfraredVault,
  INativeRewardVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createBGTMIsolationModeTokenVaultV1,
  createBGTMIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0xe3b9B72ba027FD6c514C0e5BA075Ac9c77C23Afa';
const VALIDATOR_ADDRESS = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const MIN_BLOCK_LEN = 8191;
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('BerachainRewardsMetaVault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let bgtmFactory: BGTMIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let dolomiteTokenImplementation: DolomiteERC4626;
  let dolomiteToken: DolomiteERC4626;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredVault;
  let bgtmWrapper: BGTMERC20Wrapper;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let bgtVault: BGTIsolationModeTokenVaultV1;
  let bgtmVault: BGTMIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;
  let bgtmMarketId: BigNumber;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      // blockNumber: 4_853_900,
      // blockNumber: 6_184_916,
      // blockNumber: 6_550_105,
      // blockNumber: 8_471_038,
      blockNumber: 8_627_800,
      network: Network.Berachain,
    });

    bgtmWrapper = await createContractWithAbi<BGTMERC20Wrapper>(
      BGTMERC20Wrapper__factory.abi,
      BGTMERC20Wrapper__factory.bytecode,
      [core.berachainRewardsEcosystem.bgtm.address],
    );

    dolomiteTokenImplementation = await createContractWithAbi<TestDolomiteERC4626>(
      DolomiteERC4626__factory.abi,
      DolomiteERC4626__factory.bytecode,
      [],
    );
    const dolomiteTokenProxy = await createDolomiteErc4626Proxy(
      core.marketIds.honey,
      core,
    );
    dolomiteToken = DolomiteERC4626__factory.connect(dolomiteTokenProxy.address, core.hhUser1);

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);

    const bgtmVaultImplementation = await createBGTMIsolationModeTokenVaultV1();
    bgtmFactory = await createBGTMIsolationModeVaultFactory(registry, bgtmWrapper, bgtmVaultImplementation, core);

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    await setEtherBalance(core.governance.address, parseEther('100'));
    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    bgtmMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtmFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtmFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtmFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await bgtmFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);
    await registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(bgtmFactory.address);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    await bgtFactory.createVault(core.hhUser1.address);
    bgtVault = setupUserVaultProxy<BGTIsolationModeTokenVaultV1>(
      await bgtFactory.getVaultByAccount(core.hhUser1.address),
      BGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await bgtmFactory.createVault(core.hhUser1.address);
    bgtmVault = setupUserVaultProxy<BGTMIsolationModeTokenVaultV1>(
      await bgtmFactory.getVaultByAccount(core.hhUser1.address),
      BGTMIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS, true);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    // Setup BGTM balance for core.hhUser2
    await underlyingToken.connect(lpWhale).transfer(core.hhUser2.address, amountWei);
    await underlyingToken.connect(core.hhUser2).approve(nativeRewardVault.address, amountWei);
    await nativeRewardVault.connect(core.hhUser2).stake(amountWei);
    await increase(ONE_DAY_SECONDS);
    await nativeRewardVault.connect(core.hhUser2).setOperator(core.berachainRewardsEcosystem.bgtm.address);
    await core.berachainRewardsEcosystem.bgtm.connect(core.hhUser2).deposit([nativeRewardVault.address]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await metaVault.OWNER()).to.eq(core.hhUser1.address);
      expect(await metaVault.REGISTRY()).to.eq(registry.address);
    });
  });

  describe('#stakeDolomiteToken', () => {
    it('should fail if token is not listed on BGT Station', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteToken.address, true);
      await expectThrow(metaVault.stakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei));
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).stakeDolomiteToken(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });

    it('should fail if the token is not valid', async () => {
      await expectThrow(
        metaVault.stakeDolomiteToken(dolomiteTokenImplementation.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );

      await expectThrow(
        metaVault.stakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );
    });
  });

  describe('#unstakeDolomiteToken', () => {
    it('should fail if token is not listed on BGT Station', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteToken.address, true);
      await expectThrow(metaVault.unstakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei));
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        metaVault
          .connect(core.hhUser2)
          .unstakeDolomiteToken(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });

    it('should fail if the token is not valid', async () => {
      await expectThrow(
        metaVault.unstakeDolomiteToken(dolomiteTokenImplementation.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );

      await expectThrow(
        metaVault.unstakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );
    });
  });

  describe('#stake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).stake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).unstake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#setDefaultRewardVaultTypeByAsset', () => {
    it('should work normally', async () => {
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Native);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Infrared);
    });

    it('should work if it sets operator on BGT multiple times', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.BGTM);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault
          .connect(core.hhUser2)
          .setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      expect(bal).to.gt(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await metaVault.bgtBalanceOf()).to.equal(bal);
      expect(await bgtVault.underlyingBalanceOf()).to.equal(bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
    });

    it('should work normally with bgtm', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const bal = await bgtmWrapper.balanceOf(metaVault.address);
      expect(bal).to.gt(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await metaVault.bgtmBalanceOf()).to.equal(bal);
      expect(await bgtmVault.underlyingBalanceOf()).to.equal(bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bal);
    });

    it('should work normally with infrared', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(4));
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const balance = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei.div(4));
      expect(await iBgtVault.underlyingBalanceOf()).to.equal(balance);
      expect(await core.tokens.iBgt.balanceOf(metaVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, balance);
    });

    it('should work if no rewards are available', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await metaVault.getReward(underlyingToken.address);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, iBgtMarketId, ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).getReward(underlyingToken.address),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work if no rewards are available', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await beraVault.exit();
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, iBgtMarketId, ZERO_BI);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).exit(underlyingToken.address),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#delegateBGT', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGT(core.hhUser1.address);
      expect(await core.tokens.bgt.delegates(metaVault.address)).to.eq(core.hhUser1.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).delegateBGT(core.hhUser2.address),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#queueBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      const res = await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metaVault, res, 'BgtValidatorSet', {
        validator: VALIDATOR_ADDRESS,
      });
      expect(await metaVault.bgtValidator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(bal);
    });

    it('should work normally when queueing twice', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal.sub(1));
      expect(await metaVault.bgtValidator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(bal.sub(1));

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, 1);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(bal);
    });

    it('should fail if there is a different active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectThrow(
        metaVault.queueBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetaVault: Does not match active validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#activateBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(bal);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await expectThrow(
        metaVault.activateBGTBoost(core.hhUser1.address),
        'BerachainRewardsMetaVault: Does not match bgt validator',
      );
    });

    it('should fail if no queued boost for validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);

      // There is no queued boost, therefore no active validator is set in the meta vault.
      await expectThrow(
        metaVault.activateBGTBoost(VALIDATOR_ADDRESS),
        'BerachainRewardsMetaVault: Does not match bgt validator',
      );

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);

      await expectThrow(
        metaVault.activateBGTBoost(VALIDATOR_ADDRESS),
        'BerachainRewardsMetaVault: No queued boost to activate',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).activateBGTBoost(VALIDATOR_ADDRESS),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#cancelBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal.sub(ONE_ETH_BI));

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_ETH_BI);
      await metaVault.cancelBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      expect(await metaVault.bgtValidator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(parseEther('.5'));
    });

    it('should reset validator if no boost is queued', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      const res = await metaVault.cancelBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metaVault, res, 'BgtValidatorSet', {
        validator: ADDRESS_ZERO,
      });
      expect(await metaVault.bgtValidator()).to.eq(ADDRESS_ZERO);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(ZERO_BI);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      await expectThrow(
        metaVault.cancelBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetaVault: Does not match bgt validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).cancelBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#dropBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(bal);

      const res = await metaVault.dropBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metaVault, res, 'BgtValidatorSet', {
        validator: ADDRESS_ZERO,
      });
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(ZERO_BI);
      expect(await metaVault.bgtValidator()).to.eq(ADDRESS_ZERO);
    });

    it('should not reset validator if still boost amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(bal);

      await metaVault.dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(bal.sub(ONE_BI));
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(ZERO_BI);
      expect(await metaVault.bgtValidator()).to.eq(VALIDATOR_ADDRESS);
    });

    it('should not reset validator if queued boost amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(ONE_BI);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      await metaVault.dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.queuedBoost(metaVault.address)).to.eq(ONE_BI);
      expect(await metaVault.bgtValidator()).to.eq(VALIDATOR_ADDRESS);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);

      await expectThrow(
        metaVault.dropBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetaVault: Does not match bgt validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#delegateBGTM', async () => {
    it('should work normally', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      const bal = await metaVault.callStatic.getReward(underlyingToken.address);
      await metaVault.getReward(underlyingToken.address);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.eq(bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bal);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.eq(bal.sub(ONE_BI));
      let position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ONE_BI);
      expect(position.confirmed).to.eq(ZERO_BI);

      await mine(8200);
      await metaVault.activateBGTM(VALIDATOR_ADDRESS);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.eq(bal.sub(ONE_BI));
      position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(VALIDATOR_ADDRESS, metaVault.address);
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ONE_BI);
    });

    it('should fail if there is a different active validator', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      await expectThrow(
        metaVault.delegateBGTM(core.hhUser2.address, ONE_BI),
        'BerachainRewardsMetaVault: Does not match active validator',
      );
    });

    it('should fail if cooldown has not passed', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      await expectThrow(
        metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI),
        'BerachainRewardsMetaVault: Queue boost cooldown not passed',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).delegateBGTM(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#activateBGTM', () => {
    it('should work normally', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      let position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ONE_BI);
      expect(position.confirmed).to.eq(ZERO_BI);

      await mine(8400);
      await metaVault.activateBGTM(VALIDATOR_ADDRESS);
      position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(VALIDATOR_ADDRESS, metaVault.address);
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ONE_BI);
    });

    it('should fail if the active validator is different', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);

      await expectThrow(
        metaVault.activateBGTM(core.hhUser1.address),
        'BerachainRewardsMetaVault: Does not match bgtm validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).activateBGTM(VALIDATOR_ADDRESS),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#unbondBGTM', () => {
    it('should work normally', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      let position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ONE_BI);
      expect(position.confirmed).to.eq(ZERO_BI);

      await mine(8400);
      await metaVault.activateBGTM(VALIDATOR_ADDRESS);
      position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(VALIDATOR_ADDRESS, metaVault.address);
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ONE_BI);

      await metaVault.unbondBGTM(VALIDATOR_ADDRESS, ONE_BI);
      position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(VALIDATOR_ADDRESS, metaVault.address);
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address)).to.eq(bal);
    });

    it('should fail if the active validator is different', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);

      await expectThrow(
        metaVault.unbondBGTM(core.hhUser1.address, ONE_BI),
        'BerachainRewardsMetaVault: Does not match bgtm validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).unbondBGTM(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#cancelBGTM', () => {
    it('should work normally', async () => {
      // @todo need to update BGTM holder for new address
      await core.berachainRewardsEcosystem.bgtm.connect(core.hhUser2).delegate(VALIDATOR_ADDRESS, ONE_BI);

      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, ONE_BI);
      let position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(ONE_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ZERO_BI);

      const res = await metaVault.cancelBGTM(VALIDATOR_ADDRESS, ONE_BI);
      await expectEvent(metaVault, res, 'BgtmValidatorSet', {
        validator: ADDRESS_ZERO,
      });
      position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(VALIDATOR_ADDRESS, metaVault.address);
      expect(position.pending).to.eq(ZERO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ZERO_BI);
    });

    it('should not reset active validator if there is still boost amount', async () => {
      await core.berachainRewardsEcosystem.bgtm.connect(core.hhUser2).delegate(VALIDATOR_ADDRESS, ONE_BI);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, TWO_BI);
      const position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(TWO_BI);
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(ZERO_BI);

      await metaVault.cancelBGTM(VALIDATOR_ADDRESS, ONE_BI);
      expect(await metaVault.bgtmValidator()).to.eq(VALIDATOR_ADDRESS);
    });

    it('should do nothing if there is no boost amount and validator is address zero', async () => {
      await metaVault.cancelBGTM(ADDRESS_ZERO, ZERO_BI);
      expect(await metaVault.bgtmValidator()).to.eq(ADDRESS_ZERO);
    });

    it('should fail if the active validator is different', async () => {
      await expectThrow(
        metaVault.cancelBGTM(core.hhUser1.address, ONE_BI),
        'BerachainRewardsMetaVault: Does not match bgtm validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).cancelBGTM(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#withdrawBGTAndRedeem', () => {
    it('should work normally with no boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with queued boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with active boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with queued and active boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal.div(2));
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal.div(2));
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally if dropping a portion of a boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
      await bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal.sub(ONE_ETH_BI));

      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      await mine(MIN_BLOCK_LEN);
      await metaVault.activateBGTBoost(VALIDATOR_ADDRESS);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      const amount = parseEther('.75');
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amount))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, amount);
      expect(await core.tokens.bgt.boosts(metaVault.address)).to.eq(parseEther('.25'));
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, parseEther('.25'));
    });

    it('should fail if not called by bgt vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).withdrawBGTAndRedeem(core.hhUser1.address, amountWei),
        'BerachainRewardsMetaVault: Not child BGT vault',
      );
    });
  });

  describe('#redeemBGTM', () => {
    it('should work normally', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bal);

      await expect(() => bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, ZERO_BI);
    });

    it('should work with pending boosts', async () => {
      await core.berachainRewardsEcosystem.bgtm.connect(core.hhUser2).delegate(VALIDATOR_ADDRESS, ONE_BI);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, bal);
      const position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(bal);
      await expect(() => bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, ZERO_BI);
    });

    it('should work with confirmed boosts', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, bal);
      await mine(8200);
      await metaVault.activateBGTM(VALIDATOR_ADDRESS);

      await expect(() => bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, ZERO_BI);
    });

    it('should work with pending and confirmed boosts', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, bal.div(2));
      await mine(8400);
      await metaVault.activateBGTM(VALIDATOR_ADDRESS);

      await core.berachainRewardsEcosystem.bgtm.connect(core.hhUser2).delegate(VALIDATOR_ADDRESS, ONE_BI);
      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, bal.div(2));
      const position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.pending).to.eq(bal.div(2));
      expect(position.queued).to.eq(ZERO_BI);
      expect(position.confirmed).to.eq(bal.div(2));

      await expect(() => bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeTokenBalance(core.tokens.wbera, core.hhUser1.address, bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, ZERO_BI);
    });

    it('should fail if boosts are queued and not available', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.berachainRewardsEcosystem.bgtm.getBalance(metaVault.address);

      await metaVault.delegateBGTM(VALIDATOR_ADDRESS, bal);
      const position = await core.berachainRewardsEcosystem.bgtm.getDelegatedBalance(
        VALIDATOR_ADDRESS,
        metaVault.address
      );
      expect(position.queued).to.eq(bal);
      await expectThrow(
        bgtmVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal),
        'Token: transfer failed',
      );
    });

    it('should fail if not called by bgtm vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).redeemBGTM(core.hhUser1.address, amountWei),
        'BerachainRewardsMetaVault: Not child BGTM vault',
      );
    });
  });

  describe('#blocksToActivateBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);
      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      await metaVault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      expect(await metaVault.blocksToActivateBgtBoost()).to.eq(MIN_BLOCK_LEN);
      await mine();
      expect(await metaVault.blocksToActivateBgtBoost()).to.eq(MIN_BLOCK_LEN - 1);
      await mine(MIN_BLOCK_LEN - 1);
      expect(await metaVault.blocksToActivateBgtBoost()).to.eq(0);
    });

    it('should return 0 if there is no validator or no boost queued', async () => {
      expect(await metaVault.blocksToActivateBgtBoost()).to.eq(ZERO_BI);
    });
  });
});
