import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network, ONE_BI, ONE_ETH_BI, TWO_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
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
  getInitiateWrappingParams,
  getOracleParams,
  getOracleProviderEnabledKey,
  getOracleProviderForTokenKeyWithOracle,
} from './gmx-v2-ecosystem-utils';

const ORACLE_V22 = '0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF';

const amountWei = parseEther('100');
const wethAmount = ONE_ETH_BI;
const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const minAmountOut = parseEther('1500');

const executionFee = ONE_ETH_BI;
const gasLimit = 10_000_000;
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

describe('GmxV2.2B', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let eventEmitter: IEventEmitterRegistry;

  let gmxV2UnderlyingToken: IGmxMarketToken;
  let gmxV2Factory: GmxV2IsolationModeVaultFactory;
  let gmxV2Vault: GmxV2IsolationModeTokenVaultV1;
  let gmxV2MarketId: BigNumber;
  let gmxV2Wrapper: GmxV2IsolationModeWrapperTraderV2;
  let gmxV2Unwrapper: GmxV2IsolationModeUnwrapperTraderV2;

  let testOracleProvider: TestOracleProvider;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 403_662_800
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    eventEmitter = core.eventEmitterRegistry;
    gmxV2UnderlyingToken = core.gmxV2Ecosystem.gmxEthUsdMarketToken.connect(core.hhUser1);
    gmxV2Factory = core.gmxV2Ecosystem.live.gmEthUsd.factory.connect(core.hhUser1);
    gmxV2Wrapper = core.gmxV2Ecosystem.live.gmEthUsd.wrapper.connect(core.hhUser1);
    gmxV2Unwrapper = core.gmxV2Ecosystem.live.gmEthUsd.unwrapper.connect(core.hhUser1);

    // Update exchange router, reader
    await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxExchangeRouter(core.gmxV2Ecosystem.gmxExchangeRouter.address);
    await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxReader(core.gmxV2Ecosystem.gmxReader.address);

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
    const usdcProviderKey = getOracleProviderForTokenKeyWithOracle(ORACLE_V22, core.tokens.nativeUsdc);
    const wethProviderKey = getOracleProviderForTokenKeyWithOracle(ORACLE_V22, core.tokens.weth);
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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should wrap normally for gmxV2', async () => {
    await core.depositWithdrawalRouter.connect(core.hhUser1).depositPayable(
      gmxV2MarketId,
      borrowAccountNumber,
      0,
      { value: wethAmount }
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
    const res = await core.genericTraderRouter.connect(core.hhUser1).swapExactInputForOutput(
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
    const res = await gmxV2Vault.initiateUnwrapping(
      defaultAccountNumber,
      amountWei,
      core.tokens.weth.address,
      minAmountOut,
      DEFAULT_EXTRA_DATA,
      { value: executionFee },
    );

    const filter = eventEmitter.filters.AsyncWithdrawalCreated();
    const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
    const withdrawalKey = eventArgs.key;
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
      parseEther('.04'),
      '0',
    );
    await expectProtocolBalance(core, gmxV2Vault.address, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
    expect(await gmxV2Vault.isVaultFrozen()).to.eq(false);
    expect(await gmxV2Vault.shouldSkipTransfer()).to.eq(false);
    expect(await gmxV2Vault.isDepositSourceWrapper()).to.eq(false);
    expect(await gmxV2UnderlyingToken.balanceOf(gmxV2Vault.address)).to.eq(ZERO_BI);
  });
});
