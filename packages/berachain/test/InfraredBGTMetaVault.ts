import { DolomiteOwnerV2 } from '@dolomite-exchange/modules-admin/src/types';
import { createDolomiteOwnerV2 } from '@dolomite-exchange/modules-admin/test/admin-ecosystem-utils';
import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  createContractWithAbi,
  createTestToken,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { Ownable__factory } from 'packages/tokenomics/src/types';
import {
  BerachainRewardsRegistry,
  IERC20__factory,
  IInfraredVault,
  IInfraredVault__factory,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperTraderV2,
  TestInfraredVault,
  TestInfraredVault__factory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeUnwrapperTraderV2,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2,
  createPolLiquidatorProxy,
  RewardVaultType,
  wrapFullBalanceIntoVaultDefaultAccount,
} from './berachain-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');
const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const TIMELOCK = ONE_DAY_SECONDS;

describe('InfraredBGTMetaVault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let metaVault: InfraredBGTMetaVault;

  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;

  let testInfraredVault: TestInfraredVault;
  let dolomiteOwner: DolomiteOwnerV2;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  let dToken: DolomiteERC4626;
  let infraredVault: IInfraredVault;
  let parAmount: BigNumber;
  let marketId: BigNumber;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 2_040_000,
      network: Network.Berachain,
    });

    await disableInterestAccrual(core, core.marketIds.weth);

    dToken = core.dolomiteTokens.weth!.connect(core.hhUser1);
    const implementation = await createContractWithAbi<DolomiteERC4626>(
      DolomiteERC4626__factory.abi,
      DolomiteERC4626__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const dTokenProxy = RegistryProxy__factory.connect(dToken.address, core.governance);
    await dTokenProxy.upgradeTo(implementation.address);

    const liquidatorProxyV6 = await createLiquidatorProxyV6(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV6);
    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    infraredVault = IInfraredVault__factory.connect(
      await registry.rewardVault(dToken.address, RewardVaultType.Infrared),
      core.hhUser1,
    );

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, parseEther('2000')); // same price as WETH
    await setupTestMarket(core, factory, true);

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    wrapper = await createPOLIsolationModeWrapperTraderV2(core, registry, factory);
    unwrapper = await createPOLIsolationModeUnwrapperTraderV2(core, registry, factory);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await factory.connect(core.governance).ownerInitialize([wrapper.address, unwrapper.address]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<POLIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      POLIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = InfraredBGTMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    testInfraredVault = await createContractWithAbi<TestInfraredVault>(
      TestInfraredVault__factory.abi,
      TestInfraredVault__factory.bytecode,
      [dToken.address],
    );

    dolomiteOwner = await createDolomiteOwnerV2(core, TIMELOCK);
    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(OTHER_ROLE);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(OTHER_ROLE, dToken.address);
    await dolomiteOwner
      .connect(dolomiteOwnerImpersonator)
      .grantRole(await dolomiteOwner.BYPASS_TIMELOCK_ROLE(), dToken.address);
    await dolomiteOwner
      .connect(dolomiteOwnerImpersonator)
      .grantRole(await dolomiteOwner.EXECUTOR_ROLE(), dToken.address);
    await dolomiteOwner
      .connect(dolomiteOwnerImpersonator)
      .ownerAddRoleToAddressFunctionSelectors(OTHER_ROLE, core.dolomiteMargin.address, ['0x8f6bc659']);

    await Ownable__factory.connect(core.dolomiteMargin.address, core.governance).transferOwnership(
      dolomiteOwner.address,
    );

    await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);

    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
    await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
    expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
    expect(await vault.underlyingBalanceOf()).to.equal(parAmount);

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

  describe('#setDefaultRewardVaultTypeByAsset', () => {
    // Does not work with infrared metavault
    xit('should work normally', async () => {
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(dToken.address)).to.eq(RewardVaultType.Infrared);
      await metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Native);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(dToken.address)).to.eq(RewardVaultType.Native);
    });

    it('should fail if not infrared', async () => {
      await expectThrow(
        metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.BGTM),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Infrared),
        `InfraredBGTMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#stakeDolomiteToken', () => {
    it('should work normally', async () => {
      // tested in before
    });

    it('should fail if type is not infrared', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      await expectThrow(
        metaVault.connect(vaultImpersonator).stakeDolomiteToken(dToken.address, RewardVaultType.Native, amountWei),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).stakeDolomiteToken(dToken.address, RewardVaultType.Infrared, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#unstakeDolomiteToken', () => {
    it('should work normally', async () => {
      await vault.unstake(RewardVaultType.Infrared, parAmount);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });

    it('should fail if type is not infrared', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      await expectThrow(
        metaVault.connect(vaultImpersonator).unstakeDolomiteToken(dToken.address, RewardVaultType.Native, amountWei),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).unstakeDolomiteToken(dToken.address, RewardVaultType.Infrared, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      const bexHoneyWberaWhale = await impersonate('0xC2BaA8443cDA8EBE51a640905A8E6bc4e1f9872c', true);
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', bexHoneyWberaWhale);
      const bexHoneyWberaVault = IInfraredVault__factory.connect(
        await registry.rewardVault(bexHoneyWbera.address, RewardVaultType.Infrared),
        core.hhUser1,
      );
      await bexHoneyWbera.connect(bexHoneyWberaWhale).transfer(vault.address, ONE_ETH_BI);
      await bexHoneyWbera.connect(vaultImpersonator).approve(metaVault.address, ONE_ETH_BI);

      await metaVault.connect(vaultImpersonator).stake(bexHoneyWbera.address, RewardVaultType.Infrared, ONE_ETH_BI);
      expect(await bexHoneyWberaVault.balanceOf(metaVault.address)).to.equal(ONE_ETH_BI);
      expect(await bexHoneyWbera.balanceOf(vault.address)).to.equal(ZERO_BI);
    });

    it('should fail if not infrared', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', core.hhUser1);
      await expectThrow(
        metaVault.connect(vaultImpersonator).stake(bexHoneyWbera.address, RewardVaultType.Native, amountWei),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by child vault', async () => {
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', core.hhUser1);
      await expectThrow(
        metaVault.connect(core.hhUser1).stake(bexHoneyWbera.address, RewardVaultType.Infrared, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#stakeIBgt', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).stakeIBgt(amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      const bexHoneyWberaWhale = await impersonate('0xC2BaA8443cDA8EBE51a640905A8E6bc4e1f9872c', true);
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', bexHoneyWberaWhale);
      const bexHoneyWberaVault = IInfraredVault__factory.connect(
        await registry.rewardVault(bexHoneyWbera.address, RewardVaultType.Infrared),
        core.hhUser1,
      );
      await bexHoneyWbera.connect(bexHoneyWberaWhale).transfer(vault.address, ONE_ETH_BI);
      await bexHoneyWbera.connect(vaultImpersonator).approve(metaVault.address, ONE_ETH_BI);

      await metaVault.connect(vaultImpersonator).stake(bexHoneyWbera.address, RewardVaultType.Infrared, ONE_ETH_BI);
      expect(await bexHoneyWberaVault.balanceOf(metaVault.address)).to.equal(ONE_ETH_BI);
      expect(await bexHoneyWbera.balanceOf(vault.address)).to.equal(ZERO_BI);

      await metaVault.connect(vaultImpersonator).unstake(bexHoneyWbera.address, RewardVaultType.Infrared, ONE_ETH_BI);
      expect(await bexHoneyWberaVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await bexHoneyWbera.balanceOf(vault.address)).to.equal(ONE_ETH_BI);
    });

    it('should fail if not infrared', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', core.hhUser1);
      await expectThrow(
        metaVault.connect(vaultImpersonator).unstake(bexHoneyWbera.address, RewardVaultType.Native, amountWei),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by child vault', async () => {
      const bexHoneyWbera = IERC20__factory.connect('0x2c4a603A2aA5596287A06886862dc29d56DbC354', core.hhUser1);
      await expectThrow(
        metaVault.connect(core.hhUser1).unstake(bexHoneyWbera.address, RewardVaultType.Infrared, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#unstakeIBgt', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).unstakeIBgt(amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with iBgt rewards', async () => {
      const infraredImpersonator = await impersonate(core.berachainRewardsEcosystem.infrared.address, true);
      await core.tokens.iBgt.connect(infraredImpersonator).approve(infraredVault.address, parseEther('100'));
      await infraredVault.connect(infraredImpersonator).notifyRewardAmount(core.tokens.iBgt.address, parseEther('100'));

      await increase(10 * ONE_DAY_SECONDS);
      const rewards = await infraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
      const iBgtVault = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should work normally with honey rewards', async () => {
      const rewardAmount = parseEther('1000');
      await testInfraredVault.setRewardTokens([core.tokens.honey.address]);
      await setupHONEYBalance(core, core.hhUser1, rewardAmount, { address: testInfraredVault.address });
      await testInfraredVault.connect(core.hhUser1).addReward(core.tokens.honey.address, rewardAmount);
      await registry
        .connect(dolomiteOwnerImpersonator)
        .ownerSetRewardVaultOverride(dToken.address, RewardVaultType.Infrared, testInfraredVault.address);

      const rewards = await testInfraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should work normally for reward that has reached max supply wei', async () => {
      const rewardAmount = parseEther('1000');
      await testInfraredVault.setRewardTokens([core.tokens.honey.address]);
      await setupHONEYBalance(core, core.hhUser1, rewardAmount, { address: testInfraredVault.address });
      await testInfraredVault.connect(core.hhUser1).addReward(core.tokens.honey.address, rewardAmount);
      await registry
        .connect(dolomiteOwnerImpersonator)
        .ownerSetRewardVaultOverride(dToken.address, RewardVaultType.Infrared, testInfraredVault.address);

      await expectWalletBalance(core.hhUser1, core.tokens.honey, ZERO_BI);
      await core.dolomiteMargin.connect(dolomiteOwnerImpersonator).ownerSetMaxSupplyWei(core.marketIds.honey, ONE_BI);
      const rewards = await testInfraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
      await expectWalletBalance(core.hhUser1, core.tokens.honey, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should work normally for reward not listed on dolomite', async () => {
      const rewardAmount = parseEther('1000');
      const testToken = await createTestToken();
      await testInfraredVault.setRewardTokens([testToken.address]);
      await testToken.addBalance(core.hhUser1.address, rewardAmount);
      await testToken.connect(core.hhUser1).approve(testInfraredVault.address, rewardAmount);
      await testInfraredVault.connect(core.hhUser1).addReward(testToken.address, rewardAmount);
      await registry
        .connect(dolomiteOwnerImpersonator)
        .ownerSetRewardVaultOverride(dToken.address, RewardVaultType.Infrared, testInfraredVault.address);

      await expectWalletBalance(core.hhUser1, testToken, ZERO_BI);
      const rewards = await testInfraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
      await expectWalletBalance(core.hhUser1, testToken, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should work normally with iBgt rewards if vault is already created', async () => {
      const infraredImpersonator = await impersonate(core.berachainRewardsEcosystem.infrared.address, true);
      await core.tokens.iBgt.connect(infraredImpersonator).approve(infraredVault.address, parseEther('100'));
      await iBgtFactory.createVault(core.hhUser1.address);
      const iBgtVault = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );

      await infraredVault.connect(infraredImpersonator).notifyRewardAmount(core.tokens.iBgt.address, parseEther('100'));
      await increase(10 * ONE_DAY_SECONDS);
      const rewards = await infraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should work normally with no rewards', async () => {
      const testToken = await createTestToken();
      await testInfraredVault.setRewardTokens([testToken.address]);
      await registry
        .connect(dolomiteOwnerImpersonator)
        .ownerSetRewardVaultOverride(dToken.address, RewardVaultType.Infrared, testInfraredVault.address);

      await vault.getReward();
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).getReward(dToken.address),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#getRewardIBgt', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).getRewardIBgt(),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally', async () => {
      const infraredImpersonator = await impersonate(core.berachainRewardsEcosystem.infrared.address, true);
      await core.tokens.iBgt.connect(infraredImpersonator).approve(infraredVault.address, parseEther('100'));

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin
        .connect(dolomiteOwnerImpersonator)
        .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
      await infraredVault.connect(infraredImpersonator).notifyRewardAmount(core.tokens.iBgt.address, parseEther('100'));
      await increase(10 * ONE_DAY_SECONDS);
      const rewards = await infraredVault.getAllRewardsForUser(metaVault.address);
      await vault.exit();
      const iBgtVault = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, amountWei);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).exit(dToken.address, true),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#chargeDTokenFee', () => {
    it('should work normally', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      await vault.unstake(RewardVaultType.Infrared, parAmount);
      await expectWalletBalance(metaVault, dToken, parAmount);

      await registry.connect(dolomiteOwnerImpersonator).ownerSetPolFeeAgent(core.hhUser5.address);
      await registry.connect(dolomiteOwnerImpersonator).ownerSetPolFeePercentage(parseEther('.1'));
      const feeAmount = parAmount.div(10);
      await metaVault.connect(vaultImpersonator).chargeDTokenFee(dToken.address, marketId, parAmount);
      await expectWalletBalance(core.hhUser5, dToken, feeAmount);
      await expectWalletBalance(metaVault, dToken, parAmount.sub(feeAmount));
    });

    it('should work normally with no fee or fee agent', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      await vault.unstake(RewardVaultType.Infrared, parAmount);
      await expectWalletBalance(metaVault, dToken, parAmount);

      await metaVault.connect(vaultImpersonator).chargeDTokenFee(dToken.address, marketId, parAmount);
      await expectWalletBalance(core.hhUser5, dToken, ZERO_BI);
      await expectWalletBalance(metaVault, dToken, parAmount);
    });

    it('should work normally with fee but no fee agent', async () => {
      const vaultImpersonator = await impersonate(vault.address, true);
      await vault.unstake(RewardVaultType.Infrared, parAmount);
      await expectWalletBalance(metaVault, dToken, parAmount);

      await registry.connect(dolomiteOwnerImpersonator).ownerSetPolFeePercentage(parseEther('.1'));
      await metaVault.connect(vaultImpersonator).chargeDTokenFee(dToken.address, marketId, parAmount);
      await expectWalletBalance(core.hhUser5, dToken, ZERO_BI);
      await expectWalletBalance(metaVault, dToken, parAmount);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).chargeDTokenFee(dToken.address, marketId, parAmount),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });
});
