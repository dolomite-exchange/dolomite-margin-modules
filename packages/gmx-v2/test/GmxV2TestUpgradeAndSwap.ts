import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network, ONE_BI, ONE_ETH_BI, TWO_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalance,
} from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupUserVaultProxy,
} from 'packages/base/test/utils/setup';
import {
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IEventEmitterRegistry,
  IGmxMarketToken,
  IGmxRoleStore__factory,
  TestOracleProvider,
  TestOracleProvider__factory,
} from '../src/types';
import {
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2Implementation,
  createGmxV2IsolationModeWrapperTraderV2Implementation,
  createGmxV2Library,
  getInitiateWrappingParams,
  getOracleParams,
  getOracleProviderEnabledKey,
  getOracleProviderForTokenKey,
} from './gmx-v2-ecosystem-utils';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  IGlvToken
} from 'packages/glv/src/types';
import { BorrowPositionRouter, GenericTraderRouter, DepositWithdrawalRouter } from 'packages/base/src/types';
import {
  createAndUpgradeDolomiteRegistry,
  createBorrowPositionRouter,
  createDolomiteAccountRegistryImplementation,
  createGenericTraderProxyV2,
  createGenericTraderRouter,
  createDepositWithdrawalRouter
} from 'packages/base/test/utils/dolomite';
import {
  createGlvIsolationModeTokenVaultV1,
  createGlvIsolationModeUnwrapperTraderV2Implementation,
  createGlvIsolationModeWrapperTraderV2Implementation,
  createGlvLibrary
} from 'packages/glv/test/glv-ecosystem-utils';

const amountWei = parseEther('100');
const wethAmount = ONE_ETH_BI;
const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const minAmountOut = parseEther('500');

const executionFee = ONE_ETH_BI;
const gasLimit = 10_000_000;
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

describe('GmxV2TestUpgradeAndSwap', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let eventEmitter: IEventEmitterRegistry;

  let gmxV2UnderlyingToken: IGmxMarketToken;
  let gmxV2Factory: GmxV2IsolationModeVaultFactory;
  let gmxV2Vault: GmxV2IsolationModeTokenVaultV1;
  let gmxV2MarketId: BigNumber;
  let gmxV2Wrapper: GmxV2IsolationModeWrapperTraderV2;
  let gmxV2Unwrapper: GmxV2IsolationModeUnwrapperTraderV2;

  let glvUnderlyingToken: IGlvToken;
  let glvFactory: GlvIsolationModeVaultFactory;
  let glvVault: GlvIsolationModeTokenVaultV1;
  let glvMarketId: BigNumber;
  let glvWrapper: GlvIsolationModeWrapperTraderV2;
  let glvUnwrapper: GlvIsolationModeUnwrapperTraderV2;

  let depositWithdrawalRouter: DepositWithdrawalRouter;
  let borrowPositionRouter: BorrowPositionRouter;
  let genericTraderRouter: GenericTraderRouter;

  let testOracleProvider: TestOracleProvider;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);
    await createAndUpgradeDolomiteRegistry(core);

    const genericTraderProxy = await createGenericTraderProxyV2(core);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    eventEmitter = core.eventEmitterRegistry;
    gmxV2UnderlyingToken = core.gmxV2Ecosystem.gmxEthUsdMarketToken.connect(core.hhUser1);
    gmxV2Factory = core.gmxV2Ecosystem.live.gmEthUsd.factory.connect(core.hhUser1);
    gmxV2Wrapper = core.gmxV2Ecosystem.live.gmEthUsd.wrapper.connect(core.hhUser1);
    gmxV2Unwrapper = core.gmxV2Ecosystem.live.gmEthUsd.unwrapper.connect(core.hhUser1);

    glvUnderlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    glvFactory = core.glvEcosystem.live.glvEth.factory.connect(core.hhUser1);
    glvWrapper = core.glvEcosystem.live.glvEth.wrapper.connect(core.hhUser1);
    glvUnwrapper = core.glvEcosystem.live.glvEth.unwrapper.connect(core.hhUser1);

    // Upgrade DolomiteAccountRegistry
    const accountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(accountRegistry.address);

    // Upgrade GMXV2 Wrapper/Unwrapper and token vault
    const library = await createGmxV2Library();
    const gmxV2UserVaultImpl = await createGmxV2IsolationModeTokenVaultV1(core, library);
    const wrapperImpl = await createGmxV2IsolationModeWrapperTraderV2Implementation(core, library);
    const unwrapperImpl = await createGmxV2IsolationModeUnwrapperTraderV2Implementation(core, library);
    await core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy.connect(core.governance).upgradeTo(wrapperImpl.address);
    await core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy.connect(core.governance).upgradeTo(unwrapperImpl.address);
    await gmxV2Factory.connect(core.governance).ownerSetUserVaultImplementation(gmxV2UserVaultImpl.address);

    // Upgrade GLV Wrapper/Unwrapper and token vault
    const glvLibrary = await createGlvLibrary();
    const glvUserVaultImpl = await createGlvIsolationModeTokenVaultV1(core, glvLibrary, library);
    const glvWrapperImpl = await createGlvIsolationModeWrapperTraderV2Implementation(core, glvLibrary, library);
    const glvUnwrapperImpl = await createGlvIsolationModeUnwrapperTraderV2Implementation(core, glvLibrary, library);
    await glvFactory.connect(core.governance).ownerSetUserVaultImplementation(glvUserVaultImpl.address);
    await core.glvEcosystem.live.glvEth.wrapperProxy.connect(core.governance).upgradeTo(glvWrapperImpl.address);
    await core.glvEcosystem.live.glvEth.unwrapperProxy.connect(core.governance).upgradeTo(glvUnwrapperImpl.address);

    // Deploy routers and set as trusted token converters for GMXV2 and GLV markets
    depositWithdrawalRouter = await createDepositWithdrawalRouter(core, core.tokens.weth);
    borrowPositionRouter = await createBorrowPositionRouter(core);
    genericTraderRouter = await createGenericTraderRouter(core);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(depositWithdrawalRouter.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(borrowPositionRouter.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderRouter.address, true);
    await gmxV2Factory.connect(core.governance).ownerSetIsTokenConverterTrusted(depositWithdrawalRouter.address, true);
    await gmxV2Factory.connect(core.governance).ownerSetIsTokenConverterTrusted(borrowPositionRouter.address, true);
    await gmxV2Factory.connect(core.governance).ownerSetIsTokenConverterTrusted(genericTraderRouter.address, true);
    await glvFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(depositWithdrawalRouter.address, true);
    await glvFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(borrowPositionRouter.address, true);
    await glvFactory.connect(core.governance).ownerSetIsTokenConverterTrusted(genericTraderRouter.address, true);

    // Set up oracle provider
    const dataStore = core.gmxV2Ecosystem.gmxDataStore;
    const controllerKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['CONTROLLER']));
    const roleStore = IGmxRoleStore__factory.connect(await dataStore.roleStore(), core.hhUser1);
    const controllers = await roleStore.getRoleMembers(controllerKey, 0, 1);
    const controller = await impersonate(controllers[0], true);

    testOracleProvider = await createContractWithAbi<TestOracleProvider>(
      TestOracleProvider__factory.abi,
      TestOracleProvider__factory.bytecode,
      [core.oracleAggregatorV2.address],
    );
    const oracleProviderEnabledKey = getOracleProviderEnabledKey(testOracleProvider);
    const usdcProviderKey = getOracleProviderForTokenKey(core.tokens.nativeUsdc);
    const wethProviderKey = getOracleProviderForTokenKey(core.tokens.weth);
    await dataStore.connect(controller).setBool(oracleProviderEnabledKey, true);
    await dataStore.connect(controller).setAddress(usdcProviderKey, testOracleProvider.address);
    await dataStore.connect(controller).setAddress(wethProviderKey, testOracleProvider.address);

    await gmxV2Factory.createVault(core.hhUser1.address);
    gmxV2MarketId = await gmxV2Factory.marketId();

    const vaultAddress = await gmxV2Factory.getVaultByAccount(core.hhUser1.address);
    gmxV2Vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await glvFactory.createVault(core.hhUser1.address);
    glvMarketId = await glvFactory.marketId();
    const glvVaultAddress = await glvFactory.getVaultByAccount(core.hhUser1.address);
    glvVault = setupUserVaultProxy<GlvIsolationModeTokenVaultV1>(
      glvVaultAddress,
      GlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should wrap normally for gmxV2', async () => {
    await depositWithdrawalRouter.connect(core.hhUser1).depositPayable(
      gmxV2MarketId,
      borrowAccountNumber,
      0,
      { value: ONE_ETH_BI }
    );
    await expectProtocolBalance(core, gmxV2Vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);

    const initiateWrappingParams = await getInitiateWrappingParams(
      borrowAccountNumber,
      core.marketIds.weth,
      wethAmount,
      gmxV2MarketId,
      minAmountOut,
      core.gmxV2Ecosystem.live.gmEthUsd.wrapper
    );
    const res = await genericTraderRouter.swapExactInputForOutput(
      gmxV2MarketId,
      {
        accountNumber: borrowAccountNumber,
        marketIdsPath: initiateWrappingParams.marketPath,
        inputAmountWei: initiateWrappingParams.amountIn,
        minOutputAmountWei: initiateWrappingParams.minAmountOut,
        tradersPath: initiateWrappingParams.traderParams,
        makerAccounts: initiateWrappingParams.makerAccounts,
        userConfig: initiateWrappingParams.userConfig,
      },
      { value: executionFee }
    );

    await expectProtocolBalance(core, gmxV2Vault.address, borrowAccountNumber, gmxV2MarketId, minAmountOut);
    await expectProtocolBalance(core, gmxV2Vault.address, borrowAccountNumber, core.marketIds.weth, 0);
    expect(await gmxV2Vault.isVaultFrozen()).to.eq(true);
    expect(await gmxV2Vault.shouldSkipTransfer()).to.eq(false);
    expect(await gmxV2Vault.isDepositSourceWrapper()).to.eq(false);

    const filter = eventEmitter.filters.AsyncDepositCreated();
    const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
    const depositKey = eventArgs.key;

    const res2 = await core.gmxV2Ecosystem.gmxDepositHandlerV2
      .connect(core.gmxV2Ecosystem.gmxExecutor)
      .executeDeposit(
        depositKey,
        getOracleParams(
          [core.tokens.weth.address, core.tokens.nativeUsdc.address],
          [testOracleProvider.address, testOracleProvider.address],
        ),
      );
    await expectEvent(eventEmitter, res2, 'AsyncDepositExecuted', {
      key: depositKey,
      token: gmxV2Factory.address,
    });

    await expectProtocolBalance(core, gmxV2Vault.address, borrowAccountNumber, core.marketIds.weth, 0);
    await expectProtocolBalance(core, gmxV2Vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: gmxV2Vault.address, number: borrowAccountNumber },
      gmxV2MarketId,
      minAmountOut,
      10,
    );
    expect(await gmxV2UnderlyingToken.balanceOf(gmxV2Vault.address)).to.be.gte(minAmountOut);
    expect(await gmxV2Vault.isVaultFrozen()).to.eq(false);
    expect(await gmxV2Vault.shouldSkipTransfer()).to.eq(false);
    expect(await gmxV2Vault.isDepositSourceWrapper()).to.eq(false);
    expect(await gmxV2UnderlyingToken.allowance(gmxV2Wrapper.address, gmxV2Vault.address)).to.eq(0);

    const deposit = await gmxV2Wrapper.getDepositInfo(depositKey);
    expect(deposit.key).to.eq(BYTES_ZERO);
    expect(deposit.vault).to.eq(ZERO_ADDRESS);
    expect(deposit.accountNumber).to.eq(ZERO_BI);
    expect(deposit.outputAmount).to.eq(ZERO_BI);

    expect(await gmxV2Vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await gmxV2Vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
  });

  it('should unwrap normally for gmxV2', async () => {
    await setupGMBalance(core, gmxV2UnderlyingToken, core.hhUser1, amountWei, gmxV2Vault);
    await gmxV2Vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await expectProtocolBalance(core, gmxV2Vault, defaultAccountNumber, gmxV2MarketId, amountWei);
    await expectWalletBalance(gmxV2Vault, gmxV2UnderlyingToken, amountWei);
    expect(await gmxV2Vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await gmxV2Vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

    const minAmountOut = TWO_BI;
    await gmxV2Vault.initiateUnwrapping(
      defaultAccountNumber,
      amountWei,
      core.tokens.weth.address,
      minAmountOut,
      DEFAULT_EXTRA_DATA,
      { value: executionFee },
    );

    const filter = eventEmitter.filters.AsyncWithdrawalCreated();
    const events = await eventEmitter.queryFilter(filter);
    const withdrawalKey = events[events.length - 1].args.key;
    const withdrawalBefore = await gmxV2Unwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalBefore.key).to.eq(withdrawalKey);
    expect(withdrawalBefore.vault).to.eq(gmxV2Vault.address);
    expect(withdrawalBefore.accountNumber).to.eq(defaultAccountNumber);
    expect(withdrawalBefore.inputAmount).to.eq(amountWei);
    expect(withdrawalBefore.outputToken).to.eq(core.tokens.weth.address);
    expect(withdrawalBefore.outputAmount).to.eq(minAmountOut);

    const result = await core.gmxV2Ecosystem.gmxWithdrawalHandlerV2
      .connect(core.gmxV2Ecosystem.gmxExecutor)
      .executeWithdrawal(
        withdrawalKey,
        getOracleParams(
          [core.tokens.weth.address, core.tokens.nativeUsdc.address],
          [testOracleProvider.address, testOracleProvider.address],
        ),
        { gasLimit },
      );
    await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
      key: withdrawalKey,
      token: gmxV2Factory.address,
    });

    const withdrawalAfter = await gmxV2Unwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalAfter.key).to.eq(BYTES_ZERO);
    expect(withdrawalAfter.vault).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.accountNumber).to.eq(ZERO_BI);
    expect(withdrawalAfter.inputAmount).to.eq(ZERO_BI);
    expect(withdrawalAfter.outputToken).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.outputAmount).to.eq(ZERO_BI);

    await expectProtocolBalance(core, gmxV2Vault.address, defaultAccountNumber, gmxV2MarketId, ZERO_BI);
    await expectProtocolBalance(core, gmxV2Vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: core.hhUser1.address, number: defaultAccountNumber },
      core.marketIds.weth,
      parseEther('.05'),
      '0',
    );
    await expectProtocolBalance(core, gmxV2Vault.address, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
    expect(await gmxV2Vault.isVaultFrozen()).to.eq(false);
    expect(await gmxV2Vault.shouldSkipTransfer()).to.eq(false);
    expect(await gmxV2Vault.isDepositSourceWrapper()).to.eq(false);
    expect(await gmxV2UnderlyingToken.balanceOf(gmxV2Vault.address)).to.eq(ZERO_BI);
  });
});
