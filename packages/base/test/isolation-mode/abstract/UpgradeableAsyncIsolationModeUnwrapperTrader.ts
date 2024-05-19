import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin/dist/src';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { AccountStruct } from 'packages/base/src/utils/constants';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from 'packages/base/src/utils/constructors/dolomite';
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
  TestIsolationModeFreezableLiquidatorProxy,
  TestIsolationModeFreezableLiquidatorProxy__factory,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader,
  TestUpgradeableAsyncIsolationModeWrapperTrader,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  MAX_UINT_256_BI,
  Network,
  NO_EXPIRY,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import {
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
import { liquidateV4WithZapParam } from '../../utils/liquidation-utils';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { getLiquidateIsolationModeZapPath, getUnwrapZapParams } from '../../utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const otherAccountNumber = '124';
const price = BigNumber.from('10000000000000000');
const DEFAULT_KEY = '0xf9279e2a8683e34971784a3e2a24c23022cc3d7f78437d025b0cf87ebc18bee1';
const RANDOM_KEY = '0x1234567a8683e34971784a3e2a24c23022cc3d7f78437d025b0cf87ebc18bee1';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const borrowAmount = amountWei.mul(100).div(121);
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

enum UnwrapperTradeType {
  FromWithdrawal = 0,
  FromDeposit = 1,
}

const EXECUTION_FEE = ONE_ETH_BI.div(4);

describe('UpgradeableAsyncIsolationModeUnwrapperTrader', () => {
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
  let liquidatorProxy: TestIsolationModeFreezableLiquidatorProxy;
  let asyncProtocol: TestAsyncProtocol;

  let solidUser: SignerWithAddressWithSafety;
  let solidAccount: AccountStruct;
  let liquidAccount: AccountStruct;
  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    asyncProtocol = await createContractWithAbi<TestAsyncProtocol>(
      TestAsyncProtocol__factory.abi,
      TestAsyncProtocol__factory.bytecode,
      [],
    );

    liquidatorProxy = await createContractWithAbi<TestIsolationModeFreezableLiquidatorProxy>(
      TestIsolationModeFreezableLiquidatorProxy__factory.abi,
      TestIsolationModeFreezableLiquidatorProxy__factory.bytecode,
      getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    );

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestAsyncProtocolIsolationModeTokenVault>(
      'TestAsyncProtocolIsolationModeTokenVault',
      libraries,
      [asyncProtocol.address, core.tokens.weth.address],
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
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    solidUser = core.hhUser5;

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(otherToken1.address, price);
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price);
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    tokenUnwrapper = await createTestUpgradeableAsyncIsolationModeUnwrapperTrader(
      core,
      registry,
      factory,
      asyncProtocol,
    );
    tokenWrapper = await createTestUpgradeableAsyncIsolationModeWrapperTrader(core, registry, factory, asyncProtocol);
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await registry.connect(core.governance).ownerSetIsHandler(asyncProtocol.address, true);
    await registry.connect(core.governance).ownerSetIsHandler(core.dolomiteMargin.address, true);
    await registry.connect(core.governance).ownerSetWrapperByToken(factory.address, tokenWrapper.address);
    await registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, tokenUnwrapper.address);

    eventEmitter = await createEventEmitter(core);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);
    await core.genericTraderProxy.ownerSetEventEmitterRegistry(eventEmitter.address);
    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, liquidatorProxy.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(
      underlyingMarketId,
      core.liquidatorProxyV4.address,
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestAsyncProtocolIsolationModeTokenVault>(
      vaultAddress,
      TestAsyncProtocolIsolationModeTokenVault__factory,
      core.hhUser1,
    );

    await otherToken1.addBalance(asyncProtocol.address, amountWei.mul(10));
    await otherToken2.addBalance(asyncProtocol.address, amountWei.mul(10));

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

    await otherToken1.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken1.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId1, bigOtherAmountWei);

    await otherToken2.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken2.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId2, bigOtherAmountWei);

    doloMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
    solidAccount = { owner: core.hhUser5.address, number: defaultAccountNumber };
    liquidAccount = { owner: userVault.address, number: borrowAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initiateUnwrappingForLiquidation', () => {
    async function setupBalances() {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, otherMarketId1, ZERO_BI);
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenWrapper,
        ZERO_BI,
      );
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.DepositCreated()))[0].args.key;
      await asyncProtocol.executeDeposit(key, 0);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, otherMarketId1, ZERO_BI);

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(
        core,
        userVault.address,
        borrowAccountNumber,
        otherMarketId2,
        ZERO_BI.sub(borrowAmount),
      );
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, otherMarketId2, borrowAmount);
    }

    it('should work normally', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const result = await asyncProtocol.executeWithdrawal(key, 0);
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {});
    });

    it('should work normally for underwater account that must be liquidated', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price.mul(107).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      // Add a little bit to the borrow amount to cover liquidation fee
      const result = await asyncProtocol.executeWithdrawal(key, borrowAmount.add(parseEther('4')));
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, true],
      );
      const zapParam = await getUnwrapZapParams(
        underlyingMarketId,
        borrowAmount,
        otherMarketId2,
        ONE_BI,
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      await liquidateV4WithZapParam(
        core,
        solidAccount,
        liquidAccount,
        zapParam,
      );
    });

    it('should work when severely underwater', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      // Push severely underwater
      await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price.mul(150).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      // Add a little bit to the borrow amount to cover liquidation fee
      const result = await asyncProtocol.executeWithdrawal(key, borrowAmount.add(parseEther('4')));
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, false],
      );
      const zapParam = await getUnwrapZapParams(
        underlyingMarketId,
        borrowAmount,
        otherMarketId2,
        ONE_BI,
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      await liquidateV4WithZapParam(
        core,
        solidAccount,
        liquidAccount,
        zapParam,
      );
    });

    it('should fail if attempting to liquidate other subaccount', async () => {
      await setupBalances();
      // Deposit into second account
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price.mul(107).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      let key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      // Add a little bit to the borrow amount to cover liquidation fee
      const result = await asyncProtocol.executeWithdrawal(key, borrowAmount.add(parseEther('4')));
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});

      //
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: otherAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[1].args.key;
      const result2 = await asyncProtocol.executeWithdrawal(key, borrowAmount.add(parseEther('4')));
      await expectEvent(eventEmitter, result2, 'AsyncWithdrawalFailed', {});

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, true],
      );
      const zapParam = await getUnwrapZapParams(
        underlyingMarketId,
        borrowAmount,
        otherMarketId2,
        ONE_BI,
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      await expectThrow(
        liquidateV4WithZapParam(
          core,
          solidAccount,
          liquidAccount,
          zapParam,
        ),
        'AsyncIsolationModeUnwrapperImpl: Cant liquidate other subaccount',
      );
    });

    it('should fail if withdrawal keys are not retryable', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price.mul(107).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, true],
      );
      const zapParam = await getUnwrapZapParams(
        underlyingMarketId,
        borrowAmount,
        otherMarketId2,
        ONE_BI,
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      await expectThrow(
        liquidateV4WithZapParam(
          core,
          solidAccount,
          liquidAccount,
          zapParam,
        ),
        'AsyncIsolationModeUnwrapperImpl: All trades must be retryable',
      );
    });

    it('should fail if output amount is insufficient', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, price.mul(95).div(100));
      await core.testEcosystem!.testPriceOracle.setPrice(otherToken2.address, price.mul(107).div(100));
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const result = await asyncProtocol.executeWithdrawal(key, amountWei.div(2));
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, true],
      );
      const zapParam = await getUnwrapZapParams(
        underlyingMarketId,
        amountWei,
        otherMarketId2,
        amountWei.div(2),
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      // Throws with insufficient output amount
      await expectThrow(
        liquidateV4WithZapParam(
          core,
          solidAccount,
          liquidAccount,
          zapParam,
        ),
      );
    });

    it('should fail if output token mismatch', async () => {
      await setupBalances();
      await core.testEcosystem!.testPriceOracle.setPrice(
        factory.address,
        '10000000000000000', // $1.00
      );
      await core.testEcosystem!.testPriceOracle.setPrice(
        otherToken2.address,
        '10000000000000000000', // $1000.00
      );
      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
      await liquidatorProxy.prepareForLiquidation({
        extraData,
        liquidAccount: { owner: userVault.address, number: borrowAccountNumber },
        freezableMarketId: underlyingMarketId,
        inputTokenAmount: amountWei,
        outputMarketId: otherMarketId2,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
      });
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const result = await asyncProtocol.executeWithdrawal(key, amountWei.div(4));
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});

      const allKeys = [key];
      const tradeTypes = [UnwrapperTradeType.FromWithdrawal];
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, false],
      );
      const zapParam = await getLiquidateIsolationModeZapPath(
        [underlyingMarketId, otherMarketId1, otherMarketId2],
        [amountWei, amountWei.div(4), amountWei.div(4)],
        tokenUnwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;
      await expectThrow(
        liquidateV4WithZapParam(
          core,
          solidAccount,
          liquidAccount,
          zapParam,
        ),
        'AsyncIsolationModeUnwrapperImpl: Output token mismatch',
      );
    });
  });

  describe('#initialize', () => {
    it('should work', async () => {
      expect(await tokenUnwrapper.VAULT_FACTORY()).to.eq(factory.address);
      expect(await tokenUnwrapper.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await tokenUnwrapper.HANDLER_REGISTRY()).to.eq(registry.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        tokenUnwrapper.initialize(factory.address, registry.address, core.dolomiteMargin.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#callFunction', () => {
    async function setupCallFunction(amount: BigNumber = amountWei) {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.initiateUnwrapping(
        borrowAccountNumber,
        amount,
        otherToken1.address,
        ONE_BI,
        DEFAULT_ORDER_DATA,
      );
    }

    it('should work normally with one key that does not exist', async () => {
      await setupCallFunction();
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, amountWei, userVault.address, borrowAccountNumber, [0, 0], [DEFAULT_KEY, key]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expect(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        )).to.not.be.reverted;
    });

    it('should fail if input amount is greater than zero but vault does not exist', async () => {
      await tokenUnwrapper.vaultCreateWithdrawalInfo(
        DEFAULT_KEY,
        ADDRESS_ZERO,
        borrowAccountNumber,
        amountWei,
        otherToken1.address,
        ONE_BI,
        false,
        BYTES_EMPTY,
      );
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, amountWei, userVault.address, borrowAccountNumber, [0], [DEFAULT_KEY]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        ),
        `AsyncIsolationModeUnwrapperImpl: Invalid account owner <${userVault.address.toLowerCase()}>`,
      );
    });

    it('should fail if insufficient balance', async () => {
      await setupCallFunction();
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, MAX_UINT_256_BI.sub(2), userVault.address, defaultAccountNumber, [0], [key]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        ),
        `AsyncIsolationModeUnwrapperImpl: Insufficient balance <${amountWei}, ${MAX_UINT_256_BI.sub(2).toString()}>`,
      );
    });

    it('should fail if transfer amount is zero', async () => {
      await setupCallFunction();
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, 0, userVault.address, defaultAccountNumber, [0], [key]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        ),
        'AsyncIsolationModeUnwrapperImpl: Invalid transfer amount',
      );
    });

    it('should fail if transfer amount is greater than inputAmount', async () => {
      await setupCallFunction(ONE_BI);
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, 2, userVault.address, defaultAccountNumber, [0], [key]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        ),
        'AsyncIsolationModeUnwrapperImpl: Invalid transfer amount',
      );
    });

    it('should fail if vault does not exist', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address', 'uint256', 'uint256[]', 'bytes32[]'],
        [0, 0, core.hhUser1.address, defaultAccountNumber, [1], [DEFAULT_KEY]],
      );
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          orderData,
        ),
        `AsyncIsolationModeUnwrapperImpl: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser1).callFunction(
          core.hhUser5.address,
          { owner: userVault.address, number: defaultAccountNumber },
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if sender is not a global operator', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser1.address,
          { owner: userVault.address, number: defaultAccountNumber },
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should work with cleared withdrawal key', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        otherToken1.address,
        ONE_BI,
        DEFAULT_ORDER_DATA,
      );
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          ethers.utils.defaultAbiCoder.encode(
            ['uint8[]', 'bytes32[]'],
            [[0, 0], [RANDOM_KEY, key]],
          ),
        ],
      );
      await asyncProtocol.addBalance(tokenUnwrapper.address, amountWei);
      await expect(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          amountWei,
          orderData,
        ),
      ).to.not.be.reverted;
    });

    it('should work with cleared deposit key', async () => {
      await otherToken1.addBalance(tokenWrapper.address, amountWei);
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
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      );
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.DepositCreated()))[0].args.key;
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          ethers.utils.defaultAbiCoder.encode(
            ['uint8[]', 'bytes32[]'],
            [
              [1, 1],
              [RANDOM_KEY, key],
            ],
          ),
        ],
      );
      await asyncProtocol.addBalance(tokenUnwrapper.address, amountWei);
      await expect(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          amountWei,
          orderData,
        ),
      ).to.not.be.reverted;
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          core.tokens.weth.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          ZERO_BI,
          DEFAULT_ORDER_DATA,
        ),
        'UpgradeableUnwrapperTraderV2: Invalid input amount',
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        tokenUnwrapper.exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await tokenUnwrapper.getExchangeCost(
        factory.address,
        otherToken1.address,
        ONE_BI,
        BYTES_EMPTY,
      )).to.eq(ONE_BI);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(core.tokens.weth.address, otherToken1.address, ONE_BI, BYTES_EMPTY),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(factory.address, core.tokens.weth.address, ONE_BI, BYTES_EMPTY),
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(factory.address, otherToken1.address, ZERO_BI, BYTES_EMPTY),
        'UpgradeableUnwrapperTraderV2: Invalid desired input amount',
      );
    });
  });

  describe('#executeWithdrawal', () => {
    async function setupWithdrawal() {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await userVault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        otherToken1.address,
        amountWei,
        DEFAULT_ORDER_DATA,
      );
    }

    it('should work normally', async () => {
      await setupWithdrawal();
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      await asyncProtocol.executeWithdrawal(key, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should work normally if reverts with message', async () => {
      await setupWithdrawal();
      await userVault.setRevertFlag(1);
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      await asyncProtocol.executeWithdrawal(key, amountWei);
    });

    it('should work normally if reverts with no message', async () => {
      await setupWithdrawal();
      await userVault.setRevertFlag(2);
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      await asyncProtocol.executeWithdrawal(key, amountWei);
    });
  });

  describe('#executeWithdrawalForRetry', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await userVault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        otherToken1.address,
        amountWei,
        DEFAULT_ORDER_DATA,
      );
      await userVault.setRevertFlag(2);
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      await asyncProtocol.executeWithdrawal(key, amountWei);
      await userVault.setRevertFlag(0);
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await tokenUnwrapper.connect(core.hhUser5).executeWithdrawalForRetry(key, { gasLimit });
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail if withdrawal does not exist', async () => {
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser5).executeWithdrawalForRetry(DEFAULT_KEY),
        'UpgradeableUnwrapperTraderV2: Invalid withdrawal key',
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(DEFAULT_KEY),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser5).callExecuteWithdrawalForRetryAndTriggerReentrancy(DEFAULT_KEY),
        'AsyncIsolationModeUnwrapperImpl: Reentrant call',
      );
    });
  });

  describe('#cancelWithdrawal', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await userVault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        otherToken1.address,
        amountWei,
        DEFAULT_ORDER_DATA,
      );
      const key = (await asyncProtocol.queryFilter(await asyncProtocol.filters.WithdrawalCreated()))[0].args.key;
      await userVault.cancelWithdrawal(key);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
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

  describe('#createActionsForUnwrapping', () => {
    it('should fail if invalid input market', async () => {
      await expectThrow(
        tokenUnwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: otherMarketId1,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeUnwrapperImpl: Invalid input market <${core.marketIds.weth}>`,
      );
    });

    it('should fail if invalid output market', async () => {
      await expectThrow(
        tokenUnwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.weth,
          inputMarket: underlyingMarketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeUnwrapperImpl: Invalid output market <${core.marketIds.weth}>`,
      );
    });

    it('should fail if invalid order data', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256[]', 'bytes32[]', 'bool'],
        [[0, 0], [DEFAULT_KEY], false],
      );
      await expectThrow(
        tokenUnwrapper.createActionsForUnwrapping({
          orderData,
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: otherMarketId1,
          inputMarket: underlyingMarketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
        }),
        'AsyncIsolationModeUnwrapperImpl: Invalid unwrapping order data',
      );
    });

    it('should fail if invalid input amound', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256[]', 'bytes32[]', 'bool'],
        [[0], [DEFAULT_KEY], false],
      );
      await expectThrow(
        tokenUnwrapper.createActionsForUnwrapping({
          orderData,
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: otherMarketId1,
          inputMarket: underlyingMarketId,
          minOutputAmount: ONE_BI,
          inputAmount: ZERO_BI,
        }),
        'AsyncIsolationModeUnwrapperImpl: Invalid input amount',
      );
    });

    it('should fail if trades are not retryable', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256[]', 'bytes32[]', 'bool'],
        [[0], [DEFAULT_KEY], false],
      );
      await expectThrow(
        tokenUnwrapper.createActionsForUnwrapping({
          orderData,
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: userVault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: userVault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: otherMarketId1,
          inputMarket: underlyingMarketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
        }),
        'AsyncIsolationModeUnwrapperImpl: All trades must be retryable',
      );
    });
  });

  describe('#getWrapperTrader', () => {
    it('should work normally', async () => {
      expect(await tokenUnwrapper.getWrapperTrader()).to.eq(tokenWrapper.address);
    });
  });

  describe('#validateVaultExists', () => {
    it('should work normally', async () => {
      await expect(tokenUnwrapper.testValidateVaultExists(factory.address, userVault.address)).to.not.be.reverted;
    });

    it('should fail if vault does not exist', async () => {
      await expectThrow(
        tokenUnwrapper.testValidateVaultExists(factory.address, core.hhUser1.address),
        `UpgradeableUnwrapperTraderV2: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#validateIsBalanceSufficient', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(tokenUnwrapper.address, amountWei);
      await expect(await tokenUnwrapper.testValidateIsBalanceSufficient(212)).to.not.be.reverted;
    });

    it('should fail if balance is not sufficient', async () => {
      await expectThrow(
        tokenUnwrapper.testValidateIsBalanceSufficient(212),
        'UpgradeableUnwrapperTraderV2: Insufficient input token <0, 212>',
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
