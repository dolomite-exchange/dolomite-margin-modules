import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
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
  expectProtocolBalance,
  expectProtocolParBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import {
  GenericEventEmissionType,
  GenericTraderParam,
  GenericTraderType,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsRegistry,
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
const borrowAccountNumber = BigNumber.from('123');
const amountWei = parseEther('100');

describe('POLIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let metaVault: InfraredBGTMetaVault;

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
    await setupWETHBalance(core, core.governance, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.governance, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
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
    await metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Infrared);

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.hhUser4.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should revert', async () => {
      await expectThrow(vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, parAmount), 'Not implemented');
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should revert', async () => {
      await expectThrow(vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, parAmount), 'Not implemented');
    });
  });

  describe('#prepareForLiquidation', () => {
    it('should work normally to unstake', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await vault.connect(core.hhUser4).prepareForLiquidation(defaultAccountNumber, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await dToken.balanceOf(metaVault.address)).to.equal(parAmount);
    });

    it('should work normally if no unstaking is needed', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await vault.unstake(RewardVaultType.Infrared, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await dToken.balanceOf(metaVault.address)).to.equal(parAmount);

      await vault.connect(core.hhUser4).prepareForLiquidation(defaultAccountNumber, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await dToken.balanceOf(metaVault.address)).to.equal(parAmount);
    });

    it('should fail if not called by liquidator', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).prepareForLiquidation(defaultAccountNumber, parAmount),
        `POLIsolationModeTokenVaultV1: Only liquidator can call <${core.hhUser2.address.toLowerCase()}>`,
      );

      await core.liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(marketId, core.hhUser4.address);
      await expectThrow(
        vault.connect(core.hhUser2).prepareForLiquidation(defaultAccountNumber, parAmount),
        `POLIsolationModeTokenVaultV1: Only liquidator can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally to leverage and pay back debt', async () => {
      // same price as polWETH
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
      await core.dolomiteMargin
        .connect(core.governance)
        .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, parAmount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount);

      const wrapperParam: GenericTraderParam = {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        [core.marketIds.weth, marketId],
        amountWei,
        parAmount,
        [wrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(amountWei));
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount.mul(2));
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.mul(2));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount.mul(2));

      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        [marketId, core.marketIds.weth],
        parAmount,
        amountWei,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
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

    it('should work normally with non max uint256', async () => {
      const wrapperParam: GenericTraderParam = {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.addCollateralAndSwapExactInputForOutput(
        ZERO_BI,
        ZERO_BI,
        [core.marketIds.weth, marketId],
        amountWei,
        ONE_BI,
        [wrapperParam],
        [
          {
            owner: metaVault.address,
            number: ZERO_BI,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });

    it('should work normally to transfer collateral and pay back debt', async () => {
      // same price as polWETH
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
      await core.dolomiteMargin
        .connect(core.governance)
        .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, parAmount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount);

      const wrapperParam: GenericTraderParam = {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        [core.marketIds.weth, marketId],
        amountWei,
        parAmount,
        [wrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(amountWei));
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount.mul(2));
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.mul(2));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount.mul(2));

      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        [marketId, core.marketIds.weth],
        parAmount,
        amountWei,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolParBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount.mul(2));
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.mul(2));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount.mul(2));
    });

    it('should work normally to transfer and unwrap within borrow account', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        [marketId, core.marketIds.weth],
        parAmount,
        amountWei,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolParBalance(core, vault, borrowAccountNumber, core.marketIds.weth, parAmount);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
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
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
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

    it('should work normally with max uint256, unstaking and fee', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await registry.connect(core.governance).ownerSetPolFeeAgent(core.hhUser5.address);
      await registry.connect(core.governance).ownerSetPolFeePercentage(parseEther('.1'));
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      const feeAmount = parAmount.div(10);
      await expectProtocolParBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        parAmount.sub(feeAmount),
      );
      await expectProtocolParBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.weth, feeAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
    });

    it('should work normally with input amount, unstaking and fee', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await registry.connect(core.governance).ownerSetPolFeeAgent(core.hhUser5.address);
      await registry.connect(core.governance).ownerSetPolFeePercentage(parseEther('.1'));
      const inputAmount = parAmount.div(4);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        inputAmount,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      const feeAmount = inputAmount.div(10);
      await expectProtocolParBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.weth, feeAmount);
      await expectProtocolParBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        inputAmount.sub(feeAmount),
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount.sub(inputAmount));
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.sub(inputAmount));
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount.sub(inputAmount));
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
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        [marketId, core.marketIds.weth],
        MAX_UINT_256_BI,
        ONE_BI,
        [unwrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
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

    it('should work normally when wrapping and removing collateral from borrow account', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, amountWei);

      const wrapperParam: GenericTraderParam = {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        [core.marketIds.weth, marketId],
        MAX_UINT_256_BI,
        ONE_BI,
        [wrapperParam],
        [
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
        ],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
    });

    it('should fail if input amount is greater than balance', async () => {
      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await expectThrow(
        vault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          defaultAccountNumber,
          [marketId, core.marketIds.weth],
          parAmount.add(1),
          ONE_BI,
          [unwrapperParam],
          [
            {
              owner: metaVault.address,
              number: defaultAccountNumber,
            },
          ],
          {
            deadline: '123123123123123',
            balanceCheckFlag: BalanceCheckFlag.None,
            eventType: GenericEventEmissionType.None,
          },
        ),
        'POLIsolationModeTokenVaultV1: Insufficient balance',
      );
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

    it('should fail if not called by owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).stake(RewardVaultType.Infrared, parAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
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

    it('should fail if not called by owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).unstake(RewardVaultType.Infrared, parAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with iBgt rewards', async () => {
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
      const iBgtVault = InfraredBGTIsolationModeTokenVaultV1__factory.connect(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, rewards[0].amount);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).getReward(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally for infrared', async () => {
      const infraredImpersonator = await impersonate(core.berachainRewardsEcosystem.infrared.address, true);
      await core.tokens.iBgt.connect(infraredImpersonator).approve(infraredVault.address, parseEther('100'));

      await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      expect(await vault.underlyingBalanceOf()).to.equal(parAmount);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);

      await infraredVault.connect(infraredImpersonator).notifyRewardAmount(core.tokens.iBgt.address, parseEther('100'));
      await increase(10 * ONE_DAY_SECONDS);
      const rewards = await infraredVault.getAllRewardsForUser(metaVault.address);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
      await core.dolomiteMargin
        .connect(core.governance)
        .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
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

    it('should fail if not called by owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).exit(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser1.address, parAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser1.address, parAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
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
