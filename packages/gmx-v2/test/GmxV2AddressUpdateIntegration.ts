import { BYTES_ZERO, Network, ONE_BI, ONE_ETH_BI, TWO_BI, ZERO_BI } from "packages/base/src/utils/no-deps-constants";
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from "packages/base/test/utils";
import { CoreProtocolArbitrumOne } from "packages/base/test/utils/core-protocols/core-protocol-arbitrum-one";
import { disableInterestAccrual, setupCoreProtocol, setupGMBalance, setupUserVaultProxy, setupWETHBalance } from "packages/base/test/utils/setup";
import { GmxV2IsolationModeTokenVaultV1, GmxV2IsolationModeTokenVaultV1__factory, GmxV2IsolationModeUnwrapperTraderV2, GmxV2IsolationModeVaultFactory, GmxV2IsolationModeWrapperTraderV2, GmxV2Registry, IEventEmitterRegistry, IGmxMarketToken, IGmxRoleStore__factory, TestOracleProvider, TestOracleProvider__factory } from "../src/types";
import { createContractWithAbi, depositIntoDolomiteMargin } from "packages/base/src/utils/dolomite-utils";
import { BalanceCheckFlag } from "@dolomite-exchange/dolomite-margin";
import { expectEvent, expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectWalletBalance } from "packages/base/test/utils/assertions";
import { createGmxV2IsolationModeUnwrapperTraderV2, createGmxV2IsolationModeUnwrapperTraderV2Implementation, createGmxV2IsolationModeWrapperTraderV2, createGmxV2IsolationModeWrapperTraderV2Implementation, createGmxV2Library, getInitiateWrappingParams, getOracleParams, getOracleProviderEnabledKey, getOracleProviderForTokenKey } from "./gmx-v2-ecosystem-utils";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { GMX_V2_EXECUTION_FEE_FOR_TESTS } from "../src/gmx-v2-constructors";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ZERO_ADDRESS } from "@openzeppelin/upgrades/lib/utils/Addresses";

const amountWei = parseEther('100');
const wethAmount = ONE_ETH_BI;
const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const minAmountOut = parseEther('500');

const executionFee = GMX_V2_EXECUTION_FEE_FOR_TESTS;
const gasLimit = 10_000_000;
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

describe('GmxV2AddressUpdateIntegration', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGmxMarketToken;
  let gmxV2Registry: GmxV2Registry;
  let eventEmitter: IEventEmitterRegistry;

  let factory: GmxV2IsolationModeVaultFactory;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;

  let testOracleProvider: TestOracleProvider;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 266_927_400
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    eventEmitter = core.eventEmitterRegistry;
    underlyingToken = core.gmxV2Ecosystem.gmxEthUsdMarketToken.connect(core.hhUser1);
    gmxV2Registry = core.gmxV2Ecosystem.live.registry;
    factory = core.gmxV2Ecosystem.live.gmEthUsd.factory.connect(core.hhUser1);
    wrapper = core.gmxV2Ecosystem.live.gmEthUsd.wrapper.connect(core.hhUser1);
    unwrapper = core.gmxV2Ecosystem.live.gmEthUsd.unwrapper.connect(core.hhUser1);

    // Update ExchangeRouter and Reader address
    await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxExchangeRouter(core.gmxV2Ecosystem.gmxExchangeRouter.address);
    await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxReader(core.gmxV2Ecosystem.gmxReader.address);

    const library = await createGmxV2Library();
    const wrapperImpl = await createGmxV2IsolationModeWrapperTraderV2Implementation(core, library);
    const unwrapperImpl = await createGmxV2IsolationModeUnwrapperTraderV2Implementation(core, library);
    await core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy.connect(core.governance).upgradeTo(wrapperImpl.address);
    await core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy.connect(core.governance).upgradeTo(unwrapperImpl.address);

    const dataStore = core.gmxV2Ecosystem.gmxDataStore;
    const controllerKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['CONTROLLER']));
    const roleStore = IGmxRoleStore__factory.connect(await dataStore.roleStore(), core.hhUser1);
    const controllers = await roleStore.getRoleMembers(controllerKey, 0, 1);
    const controller = await impersonate(controllers[0], true);

    testOracleProvider = await createContractWithAbi<TestOracleProvider>(
      TestOracleProvider__factory.abi,
      TestOracleProvider__factory.bytecode,
      [core.oracleAggregatorV2.address]
    );
    const oracleProviderEnabledKey = getOracleProviderEnabledKey(testOracleProvider);
    const usdcProviderKey = getOracleProviderForTokenKey(core.tokens.nativeUsdc);
    const wethProviderKey = getOracleProviderForTokenKey(core.tokens.weth);
    await dataStore.connect(controller).setBool(oracleProviderEnabledKey, true);
    await dataStore.connect(controller).setAddress(usdcProviderKey, testOracleProvider.address);
    await dataStore.connect(controller).setAddress(wethProviderKey, testOracleProvider.address);

    await factory.createVault(core.hhUser1.address);
    marketId = await factory.marketId();

    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should wrap normally', async () => {
    await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);

    await vault.transferIntoPositionWithOtherToken(
      defaultAccountNumber,
      borrowAccountNumber,
      core.marketIds.weth,
      wethAmount,
      BalanceCheckFlag.Both,
    );
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);

    const initiateWrappingParams = await getInitiateWrappingParams(
      borrowAccountNumber,
      core.marketIds.weth,
      wethAmount,
      marketId,
      minAmountOut,
      wrapper,
    );
    const res = await vault.swapExactInputForOutput(
      borrowAccountNumber,
      initiateWrappingParams.marketPath,
      initiateWrappingParams.amountIn,
      initiateWrappingParams.minAmountOut,
      initiateWrappingParams.traderParams,
      initiateWrappingParams.makerAccounts,
      initiateWrappingParams.userConfig,
      { value: executionFee },
    );

    await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
    expect(await vault.isVaultFrozen()).to.eq(true);
    expect(await vault.shouldSkipTransfer()).to.eq(false);
    expect(await vault.isDepositSourceWrapper()).to.eq(false);

    const filter = eventEmitter.filters.AsyncDepositCreated();
    const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
    const depositKey = eventArgs.key;

    const res2 = await core
      .gmxV2Ecosystem.gmxDepositHandlerV2.connect(core.gmxV2Ecosystem.gmxExecutor)
      .executeDeposit(
        depositKey,
        getOracleParams(
          [core.tokens.weth.address, core.tokens.nativeUsdc.address],
          [testOracleProvider.address, testOracleProvider.address]
        ));
    await expectEvent(eventEmitter, res2, 'AsyncDepositExecuted', {
      key: depositKey,
      token: factory.address,
    });

    await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: vault.address, number: borrowAccountNumber },
      marketId,
      minAmountOut,
      10,
    );
    expect(await underlyingToken.balanceOf(vault.address)).to.be.gte(minAmountOut);
    expect(await vault.isVaultFrozen()).to.eq(false);
    expect(await vault.shouldSkipTransfer()).to.eq(false);
    expect(await vault.isDepositSourceWrapper()).to.eq(false);
    expect(await underlyingToken.allowance(wrapper.address, vault.address)).to.eq(0);

    const deposit = await wrapper.getDepositInfo(depositKey);
    expect(deposit.key).to.eq(BYTES_ZERO);
    expect(deposit.vault).to.eq(ZERO_ADDRESS);
    expect(deposit.accountNumber).to.eq(ZERO_BI);
    expect(deposit.outputAmount).to.eq(ZERO_BI);

    expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
  });

  it('should unwrap normally', async () => {
    await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);
    await expectWalletBalance(vault, underlyingToken, amountWei);
    expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

    const minAmountOut = TWO_BI;
    await vault.initiateUnwrapping(
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
    const withdrawalBefore = await unwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalBefore.key).to.eq(withdrawalKey);
    expect(withdrawalBefore.vault).to.eq(vault.address);
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
          [testOracleProvider.address, testOracleProvider.address]
        ),
        { gasLimit }
      );
    await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
      key: withdrawalKey,
      token: factory.address,
    });

    const withdrawalAfter = await unwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalAfter.key).to.eq(BYTES_ZERO);
    expect(withdrawalAfter.vault).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.accountNumber).to.eq(ZERO_BI);
    expect(withdrawalAfter.inputAmount).to.eq(ZERO_BI);
    expect(withdrawalAfter.outputToken).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.outputAmount).to.eq(ZERO_BI);

    await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
    await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: core.hhUser1.address, number: defaultAccountNumber },
      core.marketIds.weth,
      parseEther('.05'),
      '0',
    );
    await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
    expect(await vault.isVaultFrozen()).to.eq(false);
    expect(await vault.shouldSkipTransfer()).to.eq(false);
    expect(await vault.isDepositSourceWrapper()).to.eq(false);
    expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
  });
})
