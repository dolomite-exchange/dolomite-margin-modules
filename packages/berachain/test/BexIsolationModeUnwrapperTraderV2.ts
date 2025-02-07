import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  BYTES_EMPTY,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BexIsolationModeUnwrapperTraderV2,
  BexIsolationModeUnwrapperTraderV2__factory,
  BexIsolationModeWrapperTraderV2,
  BexIsolationModeWrapperTraderV2__factory,
  BGTIsolationModeVaultFactory,
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
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';
import { createDolomiteAccountRegistryImplementation, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';


const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = '123';
const amountWei = parseEther('.1');

const BEX_VAULT_ADDRESS = '0x4Be03f781C497A489E3cB0287833452cA9B9E80B';
const LP_HOLDER = '0xB7DbE5b539E4ff3fFBDe0d107703B7698Bf55d99';

describe('BexIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let factory: BerachainRewardsIsolationModeVaultFactory;

  let underlyingToken: IERC20;

  let vault: BerachainRewardsIsolationModeTokenVaultV1;
  let unwrapper: BexIsolationModeUnwrapperTraderV2;
  let metaVault: BerachainRewardsMetaVault;

  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 822_140,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(dolomiteAccountRegistry.address);

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    factory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);

    unwrapper = await createContractWithAbi<BexIsolationModeUnwrapperTraderV2>(
      BexIsolationModeUnwrapperTraderV2__factory.abi,
      BexIsolationModeUnwrapperTraderV2__factory.bytecode,
      [BEX_VAULT_ADDRESS, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address]);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    const lpImpersonator = await impersonate(LP_HOLDER, true);
    await underlyingToken.connect(lpImpersonator).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);

    await setupNewGenericTraderProxy(core, marketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#Call and Exchange for non-liquidation sale', () => {
    it.only('should work when called with the normal conditions', async () => {
      const traderParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: BYTES_EMPTY,
        makerAccountIndex: 0,
      };

      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.honey],
        amountWei,
        ONE_BI,
        [traderParam],
        [],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally for native vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for infrared vault', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Infrared, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for bgtm vault', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.BGTM, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).unstake(RewardVaultType.Native, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally for native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();
      expect(await core.tokens.bgt.balanceOf(metaVaultAddress)).to.be.gt(0);
      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
    });

    it('should work normally for infrared', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();

      // The iBGT vault is now created since we called Exit
      iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: iBgtVault.address, number: defaultAccountNumber },
        iBgtMarketId,
        ONE_BI,
        ZERO_BI,
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).exit(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally and stake into reward vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally if need to unstake full amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if need to unstake partial amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei.div(2));
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if no unstaking has to occur', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await beraVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await beraVault.registry()).to.equal(registry.address);
    });
  });
});
