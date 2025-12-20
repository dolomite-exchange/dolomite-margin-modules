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
  setupGLVBalance,
  setupUserVaultProxy,
} from 'packages/base/test/utils/setup';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  IEventEmitterRegistry,
  IGlvToken,
  IGmxRoleStore__factory,
} from '../src/types';
import {
  getGlvOracleParams,
  getInitiateWrappingParams
} from './glv-ecosystem-utils';
import { TestOracleProvider, TestOracleProvider__factory } from 'packages/gmx-v2/src/types';
import { getOracleProviderEnabledKey } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';

const GLV_ORACLE_V22 = '0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF';

const amountWei = parseEther('100');
const wethAmount = ONE_ETH_BI;
const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const minAmountOut = parseEther('2000');

const executionFee = ONE_ETH_BI;
const gasLimit = 40_000_000;
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

describe('GlvV2.2B', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let eventEmitter: IEventEmitterRegistry;

  let glvUnderlyingToken: IGlvToken;
  let glvFactory: GlvIsolationModeVaultFactory;
  let glvVault: GlvIsolationModeTokenVaultV1;
  let glvMarketId: BigNumber;
  let glvWrapper: GlvIsolationModeWrapperTraderV2;
  let glvUnwrapper: GlvIsolationModeUnwrapperTraderV2;
  let controller: SignerWithAddressWithSafety;

  let testOracleProvider: TestOracleProvider;

  before(async () => {
    hre.tracer.enabled = false;
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 406_474_200
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    eventEmitter = core.eventEmitterRegistry;
    glvUnderlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    glvFactory = core.glvEcosystem.live.glvEth.factory.connect(core.hhUser1);
    glvWrapper = core.glvEcosystem.live.glvEth.wrapper.connect(core.hhUser1);
    glvUnwrapper = core.glvEcosystem.live.glvEth.unwrapper.connect(core.hhUser1);

    // Update glv router and reader
    await core.glvEcosystem.live.registry.connect(core.governance).ownerSetGlvRouter(core.glvEcosystem.glvRouter.address);
    await core.glvEcosystem.live.registry.connect(core.governance).ownerSetGlvReader(core.glvEcosystem.glvReader.address);

    // Set up oracle provider
    const dataStore = core.gmxV2Ecosystem.gmxDataStore;
    const controllerKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['CONTROLLER']));
    const roleStore = IGmxRoleStore__factory.connect(await dataStore.roleStore(), core.hhUser1);
    const controllers = await roleStore.getRoleMembers(controllerKey, 0, 1);
    controller = await impersonate(controllers[0], true);

    testOracleProvider = await createContractWithAbi<TestOracleProvider>(
      TestOracleProvider__factory.abi,
      TestOracleProvider__factory.bytecode,
      [core.oracleAggregatorV2.address],
    );
    const oracleProviderEnabledKey = getOracleProviderEnabledKey(testOracleProvider);
    await dataStore.connect(controller).setBool(oracleProviderEnabledKey, true);

    await glvFactory.createVault(core.hhUser1.address);
    glvMarketId = await glvFactory.marketId();

    const vaultAddress = await glvFactory.getVaultByAccount(core.hhUser1.address);
    glvVault = setupUserVaultProxy<GlvIsolationModeTokenVaultV1>(
      vaultAddress,
      GlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it.only('should wrap normally for glv', async () => {
    await core.depositWithdrawalRouter.connect(core.hhUser1).depositPayable(
      glvMarketId,
      borrowAccountNumber,
      0,
      { value: wethAmount }
    );
    await expectProtocolBalance(core, glvVault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);

    const initiateWrappingParams = await getInitiateWrappingParams(
      borrowAccountNumber,
      core.marketIds.weth,
      wethAmount,
      glvMarketId,
      parseEther('.0001'),
      glvWrapper
    );
    const res = await core.genericTraderRouter.connect(core.hhUser1).swapExactInputForOutput(
      glvMarketId,
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

    await expectProtocolBalance(core, glvVault.address, borrowAccountNumber, glvMarketId, parseEther('.0001'));
    await expectProtocolBalance(core, glvVault.address, borrowAccountNumber, core.marketIds.weth, 0);
    expect(await glvVault.isVaultFrozen()).to.eq(true);
    expect(await glvVault.shouldSkipTransfer()).to.eq(false);
    expect(await glvVault.isDepositSourceWrapper()).to.eq(false);

    const filter = eventEmitter.filters.AsyncDepositCreated();
    const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
    const depositKey = eventArgs.key;

    hre.tracer.enabled = true;
    const res2 = await core.glvEcosystem.glvDepositHandler
      .connect(core.gmxV2Ecosystem.gmxExecutor)
      .executeGlvDeposit(
        depositKey,
        await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
        { gasLimit },
      );
    hre.tracer.enabled = false;
    await expectEvent(eventEmitter, res2, 'AsyncDepositExecuted', {
      key: depositKey,
      token: glvFactory.address,
    });

    await expectProtocolBalance(core, glvVault.address, borrowAccountNumber, core.marketIds.weth, 0);
    await expectProtocolBalance(core, glvVault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: glvVault.address, number: borrowAccountNumber },
      glvMarketId,
      minAmountOut,
      10,
    );
    expect(await glvUnderlyingToken.balanceOf(glvVault.address)).to.be.gte(minAmountOut);
    expect(await glvVault.isVaultFrozen()).to.eq(false);
    expect(await glvVault.shouldSkipTransfer()).to.eq(false);
    expect(await glvVault.isDepositSourceWrapper()).to.eq(false);
    expect(await glvUnderlyingToken.allowance(glvWrapper.address, glvVault.address)).to.eq(0);

    const deposit = await glvWrapper.getDepositInfo(depositKey);
    expect(deposit.key).to.eq(BYTES_ZERO);
    expect(deposit.vault).to.eq(ZERO_ADDRESS);
    expect(deposit.accountNumber).to.eq(ZERO_BI);
    expect(deposit.outputAmount).to.eq(ZERO_BI);

    expect(await glvVault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await glvVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
  });

  it('should unwrap normally for gmxV2', async () => {
    await setupGLVBalance(core, glvUnderlyingToken, core.hhUser1, amountWei, glvVault);
    await glvVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await expectProtocolBalance(core, glvVault, defaultAccountNumber, glvMarketId, amountWei);
    await expectWalletBalance(glvVault, glvUnderlyingToken, amountWei);
    expect(await glvVault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await glvVault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

    const minAmountOut = TWO_BI;
    const res = await glvVault.initiateUnwrapping(
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
    const withdrawalBefore = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalBefore.key).to.eq(withdrawalKey);
    expect(withdrawalBefore.vault).to.eq(glvVault.address);
    expect(withdrawalBefore.accountNumber).to.eq(defaultAccountNumber);
    expect(withdrawalBefore.inputAmount).to.eq(amountWei);
    expect(withdrawalBefore.outputToken).to.eq(core.tokens.weth.address);
    expect(withdrawalBefore.outputAmount).to.eq(minAmountOut);

    const result = await core.glvEcosystem.glvWithdrawalHandler
      .connect(core.gmxV2Ecosystem.gmxExecutor)
      .executeGlvWithdrawal(
        withdrawalKey,
        await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
        { gasLimit },
      );
    await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
      key: withdrawalKey,
      token: glvFactory.address,
    });

    const withdrawalAfter = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
    expect(withdrawalAfter.key).to.eq(BYTES_ZERO);
    expect(withdrawalAfter.vault).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.accountNumber).to.eq(ZERO_BI);
    expect(withdrawalAfter.inputAmount).to.eq(ZERO_BI);
    expect(withdrawalAfter.outputToken).to.eq(ZERO_ADDRESS);
    expect(withdrawalAfter.outputAmount).to.eq(ZERO_BI);

    await expectProtocolBalance(core, glvVault.address, defaultAccountNumber, glvMarketId, ZERO_BI);
    await expectProtocolBalance(core, glvVault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: core.hhUser1.address, number: defaultAccountNumber },
      core.marketIds.weth,
      parseEther('.036'),
      '0',
    );
    await expectProtocolBalance(core, glvVault.address, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
    expect(await glvVault.isVaultFrozen()).to.eq(false);
    expect(await glvVault.shouldSkipTransfer()).to.eq(false);
    expect(await glvVault.isDepositSourceWrapper()).to.eq(false);
    expect(await glvUnderlyingToken.balanceOf(glvVault.address)).to.eq(ZERO_BI);
  });
});
