import { DolomiteERC4626, DolomiteERC4626__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  BYTES_EMPTY,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IInfraredVault,
  IInfraredVault__factory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperTraderV2,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2, createPolLiquidatorProxy,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { createLiquidatorProxyV5, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { ActionType, AmountReference, BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const amountWei = parseEther('10');
const sampleTradeData = defaultAbiCoder.encode(['uint256'], [2]);

const ZERO_PAR = {
  sign: false,
  value: ZERO_BI,
};

// @todo For tests, up the interest rate a lot so par and wei have a bigger difference
describe('POLIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let metaVault: InfraredBGTMetaVault;

  let dToken: DolomiteERC4626;
  let infraredVault: IInfraredVault;
  let parAmount: BigNumber;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 2_040_000,
      network: Network.Berachain,
    });
    await disableInterestAccrual(core, core.marketIds.weth);

    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const liquidatorProxyV5 = await createLiquidatorProxyV5(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV5);
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

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI);
    await setupTestMarket(core, factory, true);

    wrapper = await createPOLIsolationModeWrapperTraderV2(core, registry, factory);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([wrapper.address]);

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
    await setupNewGenericTraderProxy(core, marketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(
        wrapper.initialize(
          factory.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(dToken.address, RewardVaultType.Infrared);
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
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount);
    });

    it('should fail if output amount is insufficient', async () => {
      const wrapperParam: GenericTraderParam = {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [2]),
        makerAccountIndex: 0,
      };
      await expectThrow(
        vault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          defaultAccountNumber,
          [core.marketIds.weth, marketId],
          MAX_UINT_256_BI,
          amountWei,
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
        ),
        `POLIsolationModeWrapperV2: Insufficient output amount <${parAmount.toString()}, ${amountWei.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.honey.address,
          ZERO_BI,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, sampleTradeData]),
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if trade originator is not a vault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          ZERO_BI,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, sampleTradeData]),
        ),
        `POLIsolationModeWrapperV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not valid', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.wbera.address,
          ZERO_BI,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, sampleTradeData]),
        ),
        `POLIsolationModeWrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is not valid', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          core.tokens.weth.address,
          ZERO_BI,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, sampleTradeData]),
        ),
        `POLIsolationModeWrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is not zero', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          amountWei,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, sampleTradeData]),
        ),
        'POLIsolationModeWrapperV2: Invalid input amount',
      );
    });
  });

  describe('#getTradeCost', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.None,
      );

      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await wrapper.connect(dolomiteMarginImpersonator).callFunction(
        core.genericTraderProxy.address,
        { owner: vault.address, number: borrowAccountNumber },
        defaultAbiCoder.encode(
          ['uint256', 'address', 'uint256'],
          [MAX_UINT_256_BI, vault.address, borrowAccountNumber]
        ),
      );
      const tradeCost = await wrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
        core.marketIds.weth,
        marketId,
        {
          owner: metaVault.address,
          number: defaultAccountNumber,
        },
        {
          owner: vault.address,
          number: borrowAccountNumber,
        },
        {
          sign: true,
          value: ZERO_BI,
        },
        {
          sign: true,
          value: parAmount,
        },
        ZERO_PAR,
        BYTES_EMPTY,
      );
      expect(tradeCost.value).to.equal(ZERO_BI);
    });

    it('should fail if input amount par is not already set', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
          {
            owner: vault.address,
            number: defaultAccountNumber,
          },
          {
            sign: true,
            value: ZERO_BI,
          },
          {
            sign: true,
            value: amountWei,
          },
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeTraderBaseV2: Invalid input amount par',
      );
    });

    it('should fail if taker account is not a vault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
          {
            owner: core.hhUser1.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeWrapperV2: Invalid taker account',
      );
    });

    it('should fail if maker account is not metavault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: core.hhUser1.address,
            number: defaultAccountNumber,
          },
          {
            owner: vault.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeWrapperV2: Invalid maker account',
      );
    });

    it('should fail if delta par is not positive', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
          {
            owner: vault.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeWrapperV2: Invalid delta par',
      );
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
          {
            owner: vault.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          {
            sign: false,
            value: ONE_BI,
          },
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeWrapperV2: Invalid delta par',
      );
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).getTradeCost(
          core.marketIds.weth,
          marketId,
          {
            owner: metaVault.address,
            number: defaultAccountNumber,
          },
          {
            owner: vault.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#createActionsForWrapping', async () => {
    it('should work normally', async () => {
      const actions = await wrapper.createActionsForWrapping(
        {
          primaryAccountId: 0,
          otherAccountId: 1,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: metaVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: marketId,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          inputAmount: ONE_BI,
          orderData: defaultAbiCoder.encode(['uint256'], [2]),
        },
      );
      expect(actions.length).to.equal(3);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      expect(actions[1].actionType).to.equal(ActionType.Trade);
      expect(actions[1].amount.value).to.equal(ZERO_BI);
      expect(actions[1].amount.ref).to.equal(AmountReference.Target);

      expect(actions[2].actionType).to.equal(ActionType.Sell);
      expect(actions[2].amount.value).to.equal(ZERO_BI);
      expect(actions[2].amount.ref).to.equal(AmountReference.Delta);
    });

    it('should fail if input market is not valid', async () => {
      await expectThrow(
        wrapper.createActionsForWrapping({
          inputMarket: core.marketIds.wbera,
          outputMarket: marketId,
          primaryAccountId: 0,
          otherAccountId: 1,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: metaVault.address,
          otherAccountNumber: defaultAccountNumber,
          minOutputAmount: ONE_BI,
          inputAmount: ONE_BI,
          orderData: defaultAbiCoder.encode(['uint256'], [2]),
        }),
        `POLIsolationModeWrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if output market is not valid', async () => {
      await expectThrow(
        wrapper.createActionsForWrapping({
          inputMarket: core.marketIds.weth,
          outputMarket: core.marketIds.wbera,
          primaryAccountId: 0,
          otherAccountId: 1,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: metaVault.address,
          otherAccountNumber: defaultAccountNumber,
          minOutputAmount: ONE_BI,
          inputAmount: ONE_BI,
          orderData: defaultAbiCoder.encode(['uint256'], [2]),
        }),
        `POLIsolationModeWrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    describe('#getExchangeCost', () => {
      it('should work normally', async () => {
        expect(await wrapper.getExchangeCost(
          core.tokens.weth.address,
          factory.address,
          parAmount,
          BYTES_EMPTY
        )).to.equal(parAmount);
      });

      it('should fail if input token is not valid', async () => {
        await expectThrow(
          wrapper.getExchangeCost(
            core.tokens.wbera.address,
            factory.address,
            parAmount,
            BYTES_EMPTY
          ),
          `POLIsolationModeWrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
        );
      });

      it('should fail if output token is not valid', async () => {
        await expectThrow(
          wrapper.getExchangeCost(
            core.tokens.weth.address,
            core.tokens.wbera.address,
            parAmount,
            BYTES_EMPTY
          ),
          `POLIsolationModeWrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
        );
      });

      it('should fail if desired input amount is 0', async () => {
        await expectThrow(
          wrapper.getExchangeCost(
            core.tokens.weth.address,
            factory.address,
            0,
            BYTES_EMPTY
          ),
          'POLIsolationModeWrapperV2: Invalid desired input amount',
        );
      });
    });
  });
});
