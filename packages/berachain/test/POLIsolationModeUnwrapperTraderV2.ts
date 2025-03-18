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
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperTraderV2,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeUnwrapperTraderV2,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2, createPolLiquidatorProxy,
  RewardVaultType,
  wrapFullBalanceIntoVaultDefaultAccount,
} from './berachain-ecosystem-utils';
import { createLiquidatorProxyV5, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { ActionType, AmountReference, BalanceCheckFlag } from '@dolomite-margin/dist/src/types';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { AccountInfoStruct } from 'packages/base/src/utils';

const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

const ZERO_PAR = {
  sign: false,
  value: ZERO_BI,
};

const ONE_PAR = {
  sign: true,
  value: ONE_BI,
};

// @todo Up interest rates for tests
// @todo Check how we can do minOutputAmount, probably can do with extra data on internal trade
describe('POLIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let metaVault: InfraredBGTMetaVault;

  let dToken: DolomiteERC4626;
  let infraredVault: IInfraredVault;
  let parAmount: BigNumber;
  let marketId: BigNumber;

  let vaultAccountStruct: AccountInfoStruct;
  let metaVaultAccountStruct: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
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
    unwrapper = await createPOLIsolationModeUnwrapperTraderV2(core, registry, factory);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([wrapper.address, unwrapper.address]);

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

    // @follow-up Will need to set as global operator or have the metavault set as local operators
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);

    vaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
    metaVaultAccountStruct = { owner: metaVault.address, number: defaultAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(
        unwrapper.initialize(
          factory.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
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
        parAmount,
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
    });

    it('should work to unwrap half of the balance', async () => {
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
        parAmount.div(2),
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

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.div(2));
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, parAmount.div(2));
      expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.div(2));
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, metaVault, defaultAccountNumber, marketId, ZERO_BI);
    });
  });

  describe('#callFunction', () => {
    it('should work if invoked properly', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginCaller).callFunction(
        core.genericTraderProxy!.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [parAmount, vault.address, ZERO_BI]),
      );
      const cursor = await factory.transferCursor();
      expect(cursor).to.eq(2);
      const transfer = await factory.getQueuedTransferByCursor(cursor);
      expect(transfer.from).to.eq(core.dolomiteMargin.address);
      expect(transfer.to).to.eq(unwrapper.address);
      expect(transfer.amount).to.eq(parAmount);
      expect(transfer.vault).to.eq(vault.address);
    });

    it('should work if invoked with max amount', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginCaller).callFunction(
        core.genericTraderProxy!.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [MAX_UINT_256_BI, vault.address, ZERO_BI]),
      );
      const cursor = await factory.transferCursor();
      expect(cursor).to.eq(2);
      const transfer = await factory.getQueuedTransferByCursor(cursor);
      expect(transfer.from).to.eq(core.dolomiteMargin.address);
      expect(transfer.to).to.eq(unwrapper.address);
      expect(transfer.amount).to.eq(parAmount);
      expect(transfer.vault).to.eq(vault.address);
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).callFunction(
          core.hhUser1.address,
          vaultAccountStruct,
          defaultAbiCoder.encode(['uint256'], [parAmount]),
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if sender param is not a global operator', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser1.address,
          vaultAccountStruct,
          defaultAbiCoder.encode(['uint256'], [parAmount]),
        ),
        `POLIsolationModeTraderBaseV2: Caller is not authorized <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if vaultOwner param is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [parAmount, core.hhUser1.address, ZERO_BI]),
        ),
        `POLIsolationModeUnwrapperV2: Account owner is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if transferAmount param is 0', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [ZERO_BI, vault.address, ZERO_BI]),
        ),
        'POLIsolationModeUnwrapperV2: Invalid transfer amount',
      );
    });

    it('should fail if vault underlying balance is less than the transfer amount (ISF)', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [amountWei, vault.address, ZERO_BI]),
        ),
        `POLIsolationModeUnwrapperV2: Insufficient balance <${parAmount.toString()}, ${amountWei.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should work normally with vault as trade originator', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      const outputAmount = await unwrapper.connect(dolomiteMarginImpersonator).callStatic.exchange(
        vault.address,
        core.dolomiteMargin.address,
        core.tokens.weth.address,
        factory.address,
        parAmount,
        BYTES_EMPTY
      );
      expect(outputAmount).to.eq(0);
    });

    it('should work normally with liquidator as trade originator', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginImpersonator).callFunction(
        core.genericTraderProxy!.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [parAmount, vault.address, ZERO_BI]),
      );
      const outputAmount = await unwrapper.connect(dolomiteMarginImpersonator).callStatic.exchange(
        core.hhUser1.address,
        core.dolomiteMargin.address,
        core.tokens.weth.address,
        factory.address,
        parAmount,
        BYTES_EMPTY
      );
      expect(outputAmount).to.eq(0);
    });

    it('should fail if trade originator has no override and is not a vault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          parAmount,
          BYTES_EMPTY
        ),
        `POLIsolationModeUnwrapperV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          ZERO_BI,
          BYTES_EMPTY
        ),
        'POLIsolationModeUnwrapperV2: Invalid input amount',
      );
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).callStatic.exchange(
          vault.address,
          core.hhUser1.address,
          core.tokens.weth.address,
          factory.address,
          parAmount,
          BYTES_EMPTY
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getTradeCost', () => {
    it('should work normally', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginImpersonator).callFunction(
        core.genericTraderProxy!.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [parAmount, vault.address, ZERO_BI]),
      );
      const tradeCost = await unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
        marketId,
        core.marketIds.weth,
        vaultAccountStruct,
        metaVaultAccountStruct,
        ZERO_PAR,
        ZERO_PAR,
        ZERO_PAR,
        BYTES_EMPTY,
      );
      expect(tradeCost.value).to.equal(parAmount);
    });

    it('should work normally with liquidator as trade originator', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginImpersonator).callFunction(
        core.genericTraderProxy!.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [parAmount, vault.address, ZERO_BI]),
      );
      const tradeCost = await unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
        marketId,
        core.marketIds.weth,
        {
          owner: core.hhUser1.address,
          number: defaultAccountNumber,
        },
        metaVaultAccountStruct,
        ZERO_PAR,
        ZERO_PAR,
        ZERO_PAR,
        BYTES_EMPTY,
      );
      expect(tradeCost.value).to.equal(parAmount);
    });

    it('should fail if input market is invalid', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          core.marketIds.wbera,
          core.marketIds.weth,
          vaultAccountStruct,
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if output market is invalid', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          marketId,
          core.marketIds.wbera,
          vaultAccountStruct,
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid maker account (vault/liquidator)', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          marketId,
          core.marketIds.weth,
          {
            owner: core.hhUser1.address,
            number: defaultAccountNumber,
          },
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid maker account <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid taker account (metavault)', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          marketId,
          core.marketIds.weth,
          vaultAccountStruct,
          {
            owner: core.hhUser1.address,
            number: defaultAccountNumber,
          },
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid taker account <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is greater than 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          marketId,
          core.marketIds.weth,
          vaultAccountStruct,
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ONE_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeUnwrapperV2: Invalid input wei',
      );
    });

    it('should fail if invalid return amount', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).callStatic.getTradeCost(
          marketId,
          core.marketIds.weth,
          vaultAccountStruct,
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        'POLIsolationModeUnwrapperV2: Invalid return amount',
      );
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).callStatic.getTradeCost(
          marketId,
          core.marketIds.weth,
          vaultAccountStruct,
          metaVaultAccountStruct,
          ZERO_PAR,
          ZERO_PAR,
          ZERO_PAR,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#createActionsForUnwrapping', () => {
    it('should work normally', async () => {
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: 0,
        otherAccountId: 1,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: metaVault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.weth,
        inputMarket: marketId,
        minOutputAmount: ONE_BI,
        inputAmount: parAmount,
        orderData: defaultAbiCoder.encode(['uint256'], [2]),
      });
      expect(actions.length).to.equal(3);
      expect(actions[0].actionType).to.eq(ActionType.Call);

      expect(actions[1].actionType).to.eq(ActionType.Sell);
      expect(actions[1].amount.value).to.equal(parAmount);
      expect(actions[1].amount.ref).to.equal(AmountReference.Delta);

      expect(actions[2].actionType).to.eq(ActionType.Trade);
      expect(actions[2].amount.value).to.equal(ZERO_BI);
      expect(actions[2].amount.ref).to.equal(AmountReference.Delta);
    });

    it('should fail if input token is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: 0,
          otherAccountId: 1,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: metaVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.weth,
          inputMarket: core.marketIds.wbera,
          minOutputAmount: ONE_BI,
          inputAmount: parAmount,
          orderData: defaultAbiCoder.encode(['uint256'], [2]),
        }),
        `POLIsolationModeUnwrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: 0,
          otherAccountId: 1,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: metaVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.wbera,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: parAmount,
          orderData: defaultAbiCoder.encode(['uint256'], [2]),
        }),
        `POLIsolationModeUnwrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.weth.address,
        parAmount,
        BYTES_EMPTY,
      )).to.eq(parAmount);
    });

    it('should fail if input token is invalid', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          core.tokens.wbera.address,
          core.tokens.weth.address,
          parAmount,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid input token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is invalid', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          factory.address,
          core.tokens.wbera.address,
          parAmount,
          BYTES_EMPTY,
        ),
        `POLIsolationModeUnwrapperV2: Invalid output token <${core.tokens.wbera.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is zero', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          factory.address,
          core.tokens.weth.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        'POLIsolationModeUnwrapperV2: Invalid desired input amount',
      );
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work normally', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.true;
      expect(await unwrapper.isValidOutputToken(core.tokens.wbera.address)).to.be.false;
      expect(await unwrapper.isValidOutputToken(core.tokens.usdc.address)).to.be.false;
      expect(await unwrapper.isValidOutputToken(factory.address)).to.be.false;
    });
  });

  describe('#token', () => {
    it('should work normally', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work normally', async () => {
      expect(await unwrapper.actionsLength()).to.eq(3);
    });
  });
});
