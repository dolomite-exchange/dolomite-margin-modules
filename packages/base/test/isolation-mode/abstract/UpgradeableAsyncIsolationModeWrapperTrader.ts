import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin/dist/src';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import {
  CustomTestToken,
  EventEmitterRegistry,
  IERC20,
  TestAsyncProtocol,
  TestAsyncProtocol__factory,
  TestAsyncProtocolIsolationModeTokenVault,
  TestAsyncProtocolIsolationModeTokenVault__factory,
  TestAsyncProtocolIsolationModeVaultFactory,
  TestHandlerRegistry,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader,
  TestUpgradeableAsyncIsolationModeWrapperTrader,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import {
  createAndUpgradeDolomiteRegistry,
  createDolomiteRegistryImplementation,
  createEventEmitter,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '../../utils/dolomite';
import {
  createTestAsyncProtocolIsolationModeVaultFactory,
  createTestHandlerRegistry,
  createTestUpgradeableAsyncIsolationModeUnwrapperTrader,
  createTestUpgradeableAsyncIsolationModeWrapperTrader,
} from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const RANDOM_KEY = '0x1234567a8683e34971784a3e2a24c23022cc3d7f78437d025b0cf87ebc18bee1';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000
const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const DEFAULT_ORDER_DATA = ethers.utils.defaultAbiCoder.encode(
  ['uint256', 'bytes'],
  [ONE_BI, ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, '0x'])],
);

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

const PLUS_ONE_BI = {
  sign: true,
  value: ONE_BI,
};

const EXECUTION_FEE = ONE_ETH_BI.div(4);

describe('UpgradeableAsyncIsolationModeWrapperTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let eventEmitter: EventEmitterRegistry;
  let tokenUnwrapper: TestUpgradeableAsyncIsolationModeUnwrapperTrader;
  let tokenWrapper: TestUpgradeableAsyncIsolationModeWrapperTrader;
  let factory: TestAsyncProtocolIsolationModeVaultFactory;
  let userVaultImplementation: TestAsyncProtocolIsolationModeTokenVault;
  let userVault: TestAsyncProtocolIsolationModeTokenVault;
  let doloMarginImpersonator: SignerWithAddressWithSafety;
  let registry: TestHandlerRegistry;
  let asyncProtocol: TestAsyncProtocol;

  let solidUser: SignerWithAddressWithSafety;
  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await createAndUpgradeDolomiteRegistry(core);
    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const genericTraderProxy = await createContractWithLibrary(
      'GenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [Network.ArbitrumOne, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    asyncProtocol = await createContractWithAbi<TestAsyncProtocol>(
      TestAsyncProtocol__factory.abi,
      TestAsyncProtocol__factory.bytecode,
      [],
    );
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestAsyncProtocolIsolationModeTokenVault>(
      'TestAsyncProtocolIsolationModeTokenVault',
      libraries,
      [asyncProtocol.address, core.tokens.weth.address, core.config.networkNumber],
    );
    registry = await createTestHandlerRegistry(core);
    underlyingToken = asyncProtocol;
    factory = await createTestAsyncProtocolIsolationModeVaultFactory(
      EXECUTION_FEE,
      registry,
      core,
      asyncProtocol,
      userVaultImplementation,
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    solidUser = core.hhUser5;

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    tokenUnwrapper = await createTestUpgradeableAsyncIsolationModeUnwrapperTrader(
      core,
      registry,
      factory,
      asyncProtocol,
    );
    tokenWrapper = await createTestUpgradeableAsyncIsolationModeWrapperTrader(core, registry, factory, asyncProtocol);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
    await registry.connect(core.governance).ownerSetIsHandler(asyncProtocol.address, true);
    await registry.connect(core.governance).ownerSetIsHandler(core.dolomiteMargin.address, true);
    await registry.connect(core.governance).ownerSetWrapperByToken(factory.address, tokenWrapper.address);
    await registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, tokenUnwrapper.address);

    eventEmitter = await createEventEmitter(core);

    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestAsyncProtocolIsolationModeTokenVault>(
      vaultAddress,
      TestAsyncProtocolIsolationModeTokenVault__factory,
      core.hhUser1,
    );

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

    await otherToken1.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken1.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId1, bigOtherAmountWei);

    doloMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work', async () => {
      expect(await tokenWrapper.VAULT_FACTORY()).to.eq(factory.address);
      expect(await tokenWrapper.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await tokenWrapper.HANDLER_REGISTRY()).to.eq(registry.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        tokenWrapper.initialize(factory.address, registry.address, core.dolomiteMargin.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(tokenWrapper.address, amountWei);
      const result = await tokenWrapper
        .connect(doloMarginImpersonator)
        .exchange(
          userVault.address,
          userVault.address,
          factory.address,
          otherToken1.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});
      expect(await userVault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if tradeOriginator is not vault', async () => {
      await expectThrow(
        tokenWrapper
          .connect(doloMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            userVault.address,
            factory.address,
            otherToken1.address,
            amountWei,
            DEFAULT_ORDER_DATA,
          ),
        `UpgradeableWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenWrapper
          .connect(doloMarginImpersonator)
          .exchange(
            userVault.address,
            userVault.address,
            factory.address,
            core.tokens.weth.address,
            amountWei,
            DEFAULT_ORDER_DATA,
          ),
        `UpgradeableWrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenWrapper
          .connect(doloMarginImpersonator)
          .exchange(
            userVault.address,
            userVault.address,
            otherToken1.address,
            otherToken1.address,
            amountWei,
            DEFAULT_ORDER_DATA,
          ),
        `UpgradeableWrapperTraderV2: Invalid output token <${otherToken1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenWrapper
          .connect(doloMarginImpersonator)
          .exchange(
            userVault.address,
            userVault.address,
            factory.address,
            otherToken1.address,
            ZERO_BI,
            DEFAULT_ORDER_DATA,
          ),
        'UpgradeableWrapperTraderV2: Invalid input amount',
      );
    });

    it('should fail if vault is frozen', async () => {
      await factory
        .connect(core.governance)
        .setVaultAccountPendingAmountForFrozenStatus(
          userVault.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          PLUS_ONE_BI,
          core.tokens.usdc.address,
        );
      await expectThrow(
        tokenWrapper
          .connect(doloMarginImpersonator)
          .exchange(
            userVault.address,
            userVault.address,
            factory.address,
            otherToken1.address,
            amountWei,
            DEFAULT_ORDER_DATA,
          ),
        `UpgradeableWrapperTraderV2: Vault is frozen <${userVault.address.toLowerCase()}>`,
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        tokenWrapper.exchange(
          userVault.address,
          userVault.address,
          factory.address,
          otherToken1.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#afterDepositExecution', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(true);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);

      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, 0);
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work normally with max uint256', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        MAX_UINT_256_BI,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(true);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);

      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, 0);
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work if received tokens is more than min amount', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, amountWei.mul(2));
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei.mul(2));
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei.mul(2));
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work normally when current wei is greater than max wei', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await core.dolomiteMargin.ownerSetMaxWei(underlyingMarketId, amountWei);
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, amountWei.mul(2));
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectWalletBalance(core.hhUser1.address, asyncProtocol, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work normally when deposit is partially filled due to max wei', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await core.dolomiteMargin.ownerSetMaxWei(underlyingMarketId, amountWei.add(amountWei.div(2)));
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, amountWei.mul(2));
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei.add(amountWei.div(2)));
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, underlyingMarketId, amountWei.div(2));
      await expectWalletBalance(core.hhUser1.address, asyncProtocol, amountWei.div(2));
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work if received tokens is more than min amount and reverts with no message', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await factory.setReversionType(1);
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, amountWei.mul(2));

      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei.mul(2));
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work if received tokens is more than min amount and reverts with message', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await factory.setReversionType(2);
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, amountWei.mul(2));

      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei.mul(2));
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should fail if deposit doesnt exist', async () => {
      const handlerImpersonator = await impersonate(asyncProtocol.address, true);
      await expectThrow(
        tokenWrapper
          .connect(handlerImpersonator)
          .afterDepositExecution(RANDOM_KEY, {
            token: otherToken1.address,
            to: userVault.address,
            minAmount: ZERO_BI,
            amount: ONE_BI,
          }),
        'UpgradeableWrapperTraderV2: Invalid deposit key',
      );
    });
  });

  describe('#afterDepositCancellation', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.cancelDeposit(key);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work normally for account number 0', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        defaultAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        defaultAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.cancelDeposit(key);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        otherMarketId1,
        amountWei.add(otherAmountWei)
      );
      await expectProtocolBalance(core, userVault.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    });

    it('should work normally when reverted with no message', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await tokenUnwrapper.setRevertFlag(1);
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.cancelDeposit(key);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(true);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);

      await tokenUnwrapper.setRevertFlag(0);
      await tokenWrapper.connect(doloMarginImpersonator).executeDepositCancellationForRetry(key, { gasLimit });
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });

    it('should work normally when reverted with message', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      const result = await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});

      await tokenUnwrapper.setRevertFlag(2);
      const key = (await asyncProtocol.queryFilter(asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.cancelDeposit(key);
      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(true);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);

      await tokenUnwrapper.setRevertFlag(0);
      await tokenWrapper.connect(doloMarginImpersonator).executeDepositCancellationForRetry(key, { gasLimit });
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      expect(await userVault.shouldSkipTransfer()).to.eq(false);
      expect(await userVault.isVaultFrozen()).to.eq(false);
      expect(await userVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    });
  });

  describe('#executeDepositCancellationForRetry', () => {
    it('should fail if not called by handler', async () => {
      await expectThrow(
        tokenWrapper.executeDepositCancellationForRetry(RANDOM_KEY, { gasLimit }),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setDepositInfoAndReducePendingAmountFromUnwrapper', () => {
    it('should fail if not called by unwrapper', async () => {
      await expectThrow(
        tokenWrapper.connect(core.hhUser1).setDepositInfoAndReducePendingAmountFromUnwrapper(RANDOM_KEY, ONE_BI, {
          key: RANDOM_KEY,
          vault: userVault.address,
          accountNumber: defaultAccountNumber,
          inputToken: otherToken1.address,
          inputAmount: amountWei,
          outputAmount: amountWei,
          isRetryable: true,
        }),
        `UpgradeableWrapperTraderV2: Only unwrapper can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.getExchangeCost(otherToken1.address, factory.address, ONE_BI, BYTES_EMPTY)).to.eq(
        ONE_BI,
      );
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenWrapper.getExchangeCost(core.tokens.weth.address, factory.address, ONE_BI, BYTES_EMPTY),
        `UpgradeableWrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenWrapper.getExchangeCost(otherToken1.address, otherToken1.address, ONE_BI, BYTES_EMPTY),
        `UpgradeableWrapperTraderV2: Invalid output token <${otherToken1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenWrapper.getExchangeCost(otherToken1.address, factory.address, ZERO_BI, BYTES_EMPTY),
        'UpgradeableWrapperTraderV2: Invalid desired input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.actionsLength()).to.eq(1);
    });
  });

  describe('#createActionsForWrapping', () => {
    it('should fail if invalid input market', async () => {
      await expectThrow(
        tokenWrapper.createActionsForWrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: underlyingMarketId,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeWrapperImpl: Invalid input market <${core.marketIds.weth}>`,
      );
    });

    it('should fail if invalid output market', async () => {
      await expectThrow(
        tokenWrapper.createActionsForWrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.weth,
          inputMarket: otherMarketId1,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeWrapperImpl: Invalid output market <${core.marketIds.weth}>`,
      );
    });
  });

  describe('#emitDepositCancelled', () => {
    it('should work normally', async () => {
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      const res = await tokenWrapper.connect(core.hhUser5).emitDepositCancelled(RANDOM_KEY);
      await expectEvent(eventEmitter, res, 'AsyncDepositCancelled', {
        key: RANDOM_KEY,
        factory: factory.address,
      });
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        tokenWrapper.connect(core.hhUser1).emitDepositCancelled(RANDOM_KEY),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  function getInitiateWrappingParams(
    accountNumber: BigNumberish,
    marketId1: BigNumberish,
    amountIn: BigNumberish,
    marketId2: BigNumberish,
    minAmountOut: BigNumberish,
    wrapper: TestUpgradeableAsyncIsolationModeWrapperTrader,
    executionFee: BigNumberish,
  ): any {
    return {
      accountNumber,
      amountIn,
      minAmountOut,
      marketPath: [marketId1, marketId2],
      traderParams: [
        {
          trader: wrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [accountNumber, executionFee]),
          makerAccountIndex: 0,
        },
      ],
      makerAccounts: [],
      userConfig: {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      },
    };
  }
});
