import { DolomiteERC4626, DolomiteERC4626__factory, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  MAX_UINT_256_BI,
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
  disableInterestAccrual,
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createContractWithLibrary, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  IInfraredVault,
  IInfraredVault__factory,
  INativeRewardVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeVaultFactory__factory,
  POLIsolationModeWrapperTraderV2,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeUnwrapperTraderV2,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';
import { createIsolationModeTokenVaultV1ActionsImpl, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';

const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('100');
const sampleTradeData = defaultAbiCoder.encode(['uint256'], [2]);

const ZERO_PAR = {
  sign: false,
  value: ZERO_BI,
};

describe('POLIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let metaVault: BerachainRewardsMetaVault;

  let dToken: DolomiteERC4626;
  let infraredVault: IInfraredVault;
  let parAmount: BigNumber;
  let marketId: BigNumber;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });
    await disableInterestAccrual(core, core.marketIds.weth);

    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    infraredVault = IInfraredVault__factory.connect(
      await registry.rewardVault(dToken.address, RewardVaultType.Infrared),
      core.hhUser1,
    );

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation);

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
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
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );
    await metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Infrared);

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    // @follow-up Will need to set as global operator or have the metavault set as local operators
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should revert', async () => {
      await expectThrow(
        vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, parAmount),
        'Not implemented',
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should revert', async () => {
      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, parAmount),
        'Not implemented',
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should work normally', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should work normally when needs to unstake', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);

      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]), // @follow-up Remember why we are encoding this
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
    });

    it('should work normally when no unstaking is needed', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await vault.unstake(RewardVaultType.Infrared, parAmount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);

      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]), // @follow-up Remember why we are encoding this
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
    });
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await vault.unstake(RewardVaultType.Infrared, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);

      await vault.stake(RewardVaultType.Infrared, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await vault.unstake(RewardVaultType.Infrared, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });
  });

  describe('#getReward', () => {
    it.only('should work normally', async () => {
      const infraredImpersonator = await impersonate(core.berachainRewardsEcosystem.infrared.address, true);
      await core.tokens.iBgt.connect(infraredImpersonator).approve(infraredVault.address, parseEther('100'));

      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await infraredVault.connect(infraredImpersonator).notifyRewardAmount(core.tokens.iBgt.address, parseEther('100'));
      await increase(10 * ONE_DAY_SECONDS);
      const rewards = await infraredVault.getAllRewardsForUser(metaVault.address);
      await vault.getReward();
    });
  });

  xdescribe('#exit', () => {
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

  describe('#underlyingBalanceOf', () => {
    it('should work normally', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      await vault.unstake(RewardVaultType.Infrared, parAmount.div(2));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      await vault.unstake(RewardVaultType.Infrared, parAmount.div(2));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await vault.registry()).to.equal(registry.address);
    });
  });
});

async function wrapFullBalanceIntoVaultDefaultAccount(
  core: CoreProtocolBerachain,
  vault: POLIsolationModeTokenVaultV1,
  metaVault: BerachainRewardsMetaVault,
  wrapper: POLIsolationModeWrapperTraderV2,
  marketId: BigNumber,
) {
    const wrapperParam: GenericTraderParam = {
      trader: wrapper.address,
      traderType: GenericTraderType.IsolationModeWrapper,
      tradeData: defaultAbiCoder.encode(['uint256'], [2]),
      makerAccountIndex: 0,
    };
    await vault.addCollateralAndSwapExactInputForOutput(
      defaultAccountNumber,
      defaultAccountNumber,
      [core.marketIds.weth, marketId],
      MAX_UINT_256_BI,
      ONE_BI,
      [wrapperParam],
      [{
        owner: metaVault.address,
        number: defaultAccountNumber,
      }],
      {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      },
    );
}
