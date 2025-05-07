import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  LiquidatorProxyV5,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  MAX_UINT_256_BI,
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
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
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IInfraredVault,
  IInfraredVault__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperTraderV2,
  POLLiquidatorProxyV1,
  TestPOLLiquidatorProxyV1,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeUnwrapperTraderV2,
  createPOLIsolationModeVaultFactory,
  createPOLIsolationModeWrapperTraderV2, createPolLiquidatorProxy,
  createTestPolLiquidatorProxy,
  RewardVaultType,
  wrapFullBalanceIntoVaultDefaultAccount,
} from './berachain-ecosystem-utils';
import { createLiquidatorProxyV5, setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { GenericEventEmissionType, GenericTraderParam, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const amountWei = parseEther('100');

describe('POLLiquidatorProxyV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let vault: POLIsolationModeTokenVaultV1;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let metaVault: InfraredBGTMetaVault;

  let polLiquidatorProxy: TestPOLLiquidatorProxyV1;
  let liquidatorProxyV5: LiquidatorProxyV5;

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
    liquidatorProxyV5 = await createLiquidatorProxyV5(core);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(liquidatorProxyV5.address, true);

    // @todo update dToken implementation to handle lossy better
    await setupWETHBalance(core, core.governance, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.governance, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);
    const implementation = await createContractWithAbi<DolomiteERC4626>(
      DolomiteERC4626__factory.abi,
      DolomiteERC4626__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const dTokenProxy = RegistryProxy__factory.connect(dToken.address, core.governance);
    await dTokenProxy.upgradeTo(implementation.address);

    polLiquidatorProxy = await createTestPolLiquidatorProxy(core, liquidatorProxyV5);

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

    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.weth,
      core.testEcosystem!.testPriceOracle.address,
    );

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(unwrapper.address, true);
    await setupNewGenericTraderProxy(core, marketId);

    await wrapFullBalanceIntoVaultDefaultAccount(core, vault, metaVault, wrapper, marketId);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(polLiquidatorProxy.address, true);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, polLiquidatorProxy.address);

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
    await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(amountWei));
    await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, parAmount.mul(2));
    expect(await infraredVault.balanceOf(metaVault.address)).to.equal(parAmount.mul(2));
    expect(await vault.underlyingBalanceOf()).to.equal(parAmount.mul(2));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await polLiquidatorProxy.LIQUIDATOR_PROXY_V5()).to.equal(liquidatorProxyV5.address);
      expect(await polLiquidatorProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#initialize', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(
        polLiquidatorProxy.initialize(),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#liquidateProofOfLiquidityCollateral', () => {
    it('should work normally if unstaking is needed', async () => {
      const interestRate = parseEther('1').div(ONE_DAY_SECONDS * 365); // 100% APR
      await core.testEcosystem?.testInterestSetter.setInterestRate(core.tokens.weth.address, { value: interestRate });
      await core.dolomiteMargin.ownerSetInterestSetter(
        core.marketIds.weth,
        core.testEcosystem!.testInterestSetter.address
      );

      await increase(ONE_DAY_SECONDS * 300);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [3]),
        makerAccountIndex: 0,
      };
      await polLiquidatorProxy.connect(core.hhUser2).liquidateProofOfLiquidityCollateral({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: [marketId, core.marketIds.weth],
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: [unwrapperParam],
        makerAccounts: [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          marketId
        )
      );
    });

    it('should work normally if no unstaking is needed', async () => {
      await vault.unstake(RewardVaultType.Infrared, parAmount.mul(2));
      const interestRate = parseEther('1').div(ONE_DAY_SECONDS * 365); // 100% APR
      await core.testEcosystem?.testInterestSetter.setInterestRate(core.tokens.weth.address, { value: interestRate });
      await core.dolomiteMargin.ownerSetInterestSetter(
        core.marketIds.weth,
        core.testEcosystem!.testInterestSetter.address
      );

      await increase(ONE_DAY_SECONDS * 300);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [3]),
        makerAccountIndex: 0,
      };
      await polLiquidatorProxy.connect(core.hhUser2).liquidateProofOfLiquidityCollateral({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: [marketId, core.marketIds.weth],
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: [unwrapperParam],
        makerAccounts: [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          marketId
        )
      );
    });

    it('should work normally if sender is local operator for solid account', async () => {
      await core.dolomiteMargin.connect(core.hhUser2).setOperators([{
        operator: core.hhUser3.address,
        trusted: true,
      }]);
      await vault.unstake(RewardVaultType.Infrared, parAmount.mul(2));
      const interestRate = parseEther('1').div(ONE_DAY_SECONDS * 365); // 100% APR
      await core.testEcosystem?.testInterestSetter.setInterestRate(core.tokens.weth.address, { value: interestRate });
      await core.dolomiteMargin.ownerSetInterestSetter(
        core.marketIds.weth,
        core.testEcosystem!.testInterestSetter.address
      );

      await increase(ONE_DAY_SECONDS * 300);
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [3]),
        makerAccountIndex: 0,
      };
      await polLiquidatorProxy.connect(core.hhUser3).liquidateProofOfLiquidityCollateral({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: [marketId, core.marketIds.weth],
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: [unwrapperParam],
        makerAccounts: [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: vault.address, number: borrowAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          marketId
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          core.marketIds.weth
        )
      );
      console.log(
        await core.dolomiteMargin.getAccountWei(
          { owner: metaVault.address, number: defaultAccountNumber },
          marketId
        )
      );
    });

    it('should fail if solid account is not sender or local operator', async () => {
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [3]),
        makerAccountIndex: 0,
      };
      await expectThrow(
        polLiquidatorProxy.connect(core.hhUser3).liquidateProofOfLiquidityCollateral({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: vault.address, number: borrowAccountNumber },
          marketIdsPath: [marketId, core.marketIds.weth],
          inputAmountWei: MAX_UINT_256_BI,
          minOutputAmountWei: MAX_UINT_256_BI,
          tradersPath: [unwrapperParam],
          makerAccounts: [{
            owner: metaVault.address,
            number: defaultAccountNumber,
          }],
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `POLLiquidatorProxyV1: Sender not operator <${core.hhUser3.address.toLowerCase()}>`
      );
    });

    it('should fail if reentered', async () => {
      const unwrapperParam: GenericTraderParam = {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: defaultAbiCoder.encode(['uint256'], [3]),
        makerAccountIndex: 0,
      };
      const data = await polLiquidatorProxy.populateTransaction.liquidateProofOfLiquidityCollateral({
        solidAccount: { owner: core.hhUser3.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: [marketId, core.marketIds.weth],
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: [unwrapperParam],
        makerAccounts: [{
          owner: metaVault.address,
          number: defaultAccountNumber,
        }],
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });
      await expectThrow(
        polLiquidatorProxy.connect(core.hhUser3).callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });
});
