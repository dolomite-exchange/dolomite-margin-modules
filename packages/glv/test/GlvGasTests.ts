import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  TWO_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  setEtherBalance,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupGLVBalance,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { TestOracleProvider, TestOracleProvider__factory } from 'packages/gmx-v2/src/types';
import { createGmxV2TraderLibrary, getOracleProviderEnabledKey } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvRegistry,
  IERC20,
  IEventEmitterRegistry,
  IGlvToken,
  IGmxRoleStore__factory,
  TestGlvIsolationModeTokenVaultV1,
  TestGlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
} from '../src/types';
import {
  createGlvIsolationModeUnwrapperTraderV2Implementation,
  createGlvIsolationModeWrapperTraderV2Implementation,
  createGlvLibrary,
  createTestGlvIsolationModeTokenVaultV1,
  getGlvOracleParams,
} from './glv-ecosystem-utils';

enum ReversionType {
  None = 0,
  Assert = 1,
  Require = 2,
}

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
// noinspection SpellCheckingInspection
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const usdcAmount = BigNumber.from('1000000000'); // $1000
const amountWei = parseEther('1');
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

const GLV_ORACLE_V22 = '0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF';

const executionFee = ONE_ETH_BI;
const gasLimit = 40_000_000;

const wethAmount = ONE_ETH_BI;

enum UnwrapTradeType {
  ForWithdrawal = 0,
  ForDeposit = 1,
}

function encodeWithdrawalKey(tradeType: UnwrapTradeType, key: string): string {
  return ethers.utils.defaultAbiCoder.encode(['uint8[]', 'bytes32[]'], [[tradeType], [key]]);
}

function encodeWithdrawalKeyForCallFunction(
  assetReference: BigNumberish,
  transferAmount: BigNumberish,
  accountOwner: string,
  accountNumber: BigNumberish,
  tradeType: UnwrapTradeType,
  key: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'address', 'uint256', 'uint8[]', 'bytes32[]'],
    [assetReference, transferAmount, accountOwner, accountNumber, [tradeType], [key]],
  );
}

describe('GlvGasTests', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let eventEmitter: IEventEmitterRegistry;

  let underlyingToken: IGlvToken;
  let factory: GlvIsolationModeVaultFactory;
  let vault: TestGlvIsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let glvWrapper: GlvIsolationModeWrapperTraderV2;
  let glvUnwrapper: GlvIsolationModeUnwrapperTraderV2;
  let glvRegistry: GlvRegistry;
  let controller: SignerWithAddressWithSafety;

  let testOracleProvider: TestOracleProvider;

  before(async () => {
    hre.tracer.gasCost = true;
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 378_495_000
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    const userVaultImplementation = await createTestGlvIsolationModeTokenVaultV1(core);
    await factory.connect(core.governance).ownerSetUserVaultImplementation(userVaultImplementation.address);

    const library = await createGlvLibrary();
    const gmxV2TraderLibrary = await createGmxV2TraderLibrary();
    const wrapperImpl = await createGlvIsolationModeWrapperTraderV2Implementation(core, library, gmxV2TraderLibrary);
    const unwrapperImpl = await createGlvIsolationModeUnwrapperTraderV2Implementation(core, library, gmxV2TraderLibrary);
    await core.glvEcosystem.live.glvEth.wrapperProxy.connect(core.governance).upgradeTo(wrapperImpl.address);
    await core.glvEcosystem.live.glvEth.unwrapperProxy.connect(core.governance).upgradeTo(unwrapperImpl.address);

    eventEmitter = core.eventEmitterRegistry;
    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    factory = core.glvEcosystem.live.glvEth.factory.connect(core.hhUser1);
    glvWrapper = core.glvEcosystem.live.glvEth.wrapper.connect(core.hhUser1);
    glvUnwrapper = core.glvEcosystem.live.glvEth.unwrapper.connect(core.hhUser1);
    glvRegistry = core.glvEcosystem.live.registry.connect(core.hhUser1);

    await factory.connect(core.governance).ownerSetExecutionFee(executionFee);
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

    if (process.env.COVERAGE === 'true') {
      console.log('\tUsing coverage configuration...');
      const callbackKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['string'], ['MAX_CALLBACK_GAS_LIMIT']),
      );
      expect(await dataStore.getUint(callbackKey)).to.eq(callbackGasLimit.div(10));
      await dataStore.connect(controller).setUint(callbackKey, callbackGasLimit);
    }

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestGlvIsolationModeTokenVaultV1>(
      vaultAddress,
      TestGlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    await setEtherBalance(core.gmxV2Ecosystem.gmxExecutor.address, parseEther('100'));

    marketId = await factory.marketId();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#afterWithdrawalCancellation', () => {
    it('should work normally', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      const res = await vault
          .connect(core.hhUser1)
          .initiateUnwrapping(defaultAccountNumber, amountWei, core.tokens.weth.address, TWO_BI, DEFAULT_EXTRA_DATA, {
            value: executionFee,
          });

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      const withdrawalKey = eventArgs.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel withdrawal
      await mine(1200);
      hre.tracer.enabled = true;
      hre.tracer.gasCost = true;
      await vault.connect(core.hhUser1).cancelWithdrawal(withdrawalKey);
      hre.tracer.enabled = false;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should work normally when execution fails because minAmountOut is too large', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      const inputValue = amountWei.mul((await core.dolomiteMargin.getMarketPrice(marketId)).value);
      const outputAmount = inputValue.div((await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value);
      const outputAmountTooLarge = outputAmount.mul(102).div(100);
        const res = await vault
          .connect(core.hhUser1)
          .initiateUnwrapping(
            borrowAccountNumber,
            amountWei,
            core.tokens.weth.address,
            outputAmountTooLarge,
            DEFAULT_EXTRA_DATA,
            { value: executionFee },
          );

    const filter = eventEmitter.filters.AsyncWithdrawalCreated();
    const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
    const withdrawalKey = eventArgs.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      hre.tracer.enabled = true;
      hre.tracer.gasCost = true;
      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      hre.tracer.enabled = false;
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalCancelled', {
        key: withdrawalKey,
        token: factory.address,
      });

      // await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    });

    it('should work normally when execution fails because minAmountOutShort is too large', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      const res = await vault
          .connect(core.hhUser1)
          .initiateUnwrapping(
            borrowAccountNumber,
            amountWei,
            core.tokens.weth.address,
            MAX_UINT_256_BI,
            ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), MAX_UINT_256_BI.sub(1)]),
            { value: executionFee },
          );

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      const withdrawalKey = eventArgs.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalCancelled', {
        key: withdrawalKey,
        token: factory.address,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    });
  });

  describe('#afterWithdrawalExecution', () => {
    let withdrawalKey: string;

    async function setupBalances(outputToken: IERC20) {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

      const minAmountOut = TWO_BI;
      const res = await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        outputToken.address,
        minAmountOut,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      // 0xa35b150b
      // 0000000000000000000000002d454740b2c4594fa690ff7fb8da457d96507a67
      // 0000000000000000000000000000000000000000000000000000000000000040
      // 000000000000000000000000000000000000000000000000000000000000000a
      // 434f4e54524f4c4c455200000000000000000000000000000000000000000000
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      withdrawalKey = eventArgs.key;
      const withdrawal = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(outputToken.address);
      expect(withdrawal.outputAmount).to.eq(minAmountOut);

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    }

    it.only('should work normally for long token from account number 0', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectWalletBalance(vault, underlyingToken, amountWei);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);

      const minAmountOut = TWO_BI;
      const res = await vault.initiateUnwrapping(
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
      expect(withdrawalBefore.vault).to.eq(vault.address);
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
        token: factory.address,
      });

      const withdrawalAfter = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
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
        wethAmount.add(ONE_BI),
        '0',
      );
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should work normally with actual oracle params and long token', async () => {
      await setupBalances(core.tokens.weth);
      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(BYTES_ZERO);
      expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
      expect(withdrawal.accountNumber).to.eq(ZERO_BI);
      expect(withdrawal.inputAmount).to.eq(ZERO_BI);
      expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
      expect(withdrawal.outputAmount).to.eq(ZERO_BI);

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.weth,
        ONE_BI,
        '100',
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should work normally with actual oracle params and short token', async () => {
      await setupBalances(core.tokens.nativeUsdc);
      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.nativeUsdc,
        '970000', // $.97
        100,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should work with fallback when swap fails due to assertion', async () => {
      await setupBalances(core.tokens.weth);
      await vault.setReversionType(ReversionType.Assert);
      expect(await vault.reversionType()).to.eq(ReversionType.Assert);

      hre.tracer.enabled = true;
      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      hre.tracer.enabled = false;
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: '',
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      // This invariant only works because we don't have multiple failed swaps stuck in the glvUnwrapper at the moment
      const withdrawalInfo = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      await expectWalletBalance(glvUnwrapper, core.tokens.weth, withdrawalInfo.outputAmount);
    });

    xit('should work normally with swap fails due to reversion with a message', async () => {
      await setupBalances(core.tokens.weth);
      await vault.setReversionType(ReversionType.Require);
      expect(await vault.reversionType()).to.eq(ReversionType.Require);

      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: 'Reverting',
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      // This invariant only works because we don't have multiple failed swaps stuck in the glvUnwrapper at the moment
      const withdrawalInfo = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      await expectWalletBalance(glvUnwrapper, core.tokens.weth, withdrawalInfo.outputAmount);
    });

    it('should work normally if user sends extra amount to withdrawal vault', async () => {
      await setupGMBalance(core, underlyingToken, core.gmxV2Ecosystem.gmxWithdrawalVault, ONE_BI);
      await setupBalances(core.tokens.weth);
      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(BYTES_ZERO);
      expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
      expect(withdrawal.accountNumber).to.eq(ZERO_BI);
      expect(withdrawal.inputAmount).to.eq(ZERO_BI);
      expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
      expect(withdrawal.outputAmount).to.eq(ZERO_BI);

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.weth,
        ONE_BI,
        '100',
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    // This POC from Guardian now fails
    xit('Send 1 Wei to Withdrawal Vault to Revert On afterWithdrawalExecution Validation', async () => {
      // Send 1 wei of GM to withdrawal vault prior to initiating a withdrawal
      await setupGLVBalance(core, underlyingToken, core.glvEcosystem.glvVault, 1);
      // A withdrawal for amountWei + 1 is created
      await setupBalances(core.tokens.nativeUsdc);
      // The protocol has amountWei GM prior to withdrawal execution
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      // There is no USDC in the glvUnwrapper
      expect(await core.tokens.nativeUsdc.balanceOf(glvUnwrapper.address)).to.eq(0);

      await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );

      // Withdrawal info object remains and is uncleared
      const withdrawal = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(core.tokens.nativeUsdc.address);
      expect(withdrawal.outputAmount).to.eq(ONE_BI);

      // The protocol STILL has amountWei GM after withdrawal execution
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);

      // Vault remains frozen, prohibiting user actions
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Funds are stuck in the glvUnwrapper
      expect(await core.tokens.nativeUsdc.balanceOf(glvUnwrapper.address)).to.be.gt(0);
    });
  });

  describe('#executeWithdrawalForRetry', () => {
    it('should work normally', async () => {
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      const borrowAmount = BigNumber.from('600000'); // $.60
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        borrowAmount,
        BalanceCheckFlag.None,
      );

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        TWO_BI,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const oldOracle = await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth);
      const price = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, price.div(100));
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const events = await eventEmitter.queryFilter(filter);
      const withdrawalKey = events[events.length - 1].args.key;

      const result = await core.glvEcosystem.glvWithdrawalHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvWithdrawal(
          withdrawalKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider, GLV_ORACLE_V22),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber}>`,
      });

      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, oldOracle);

      const result2 = await glvUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(withdrawalKey, { gasLimit });
      await expectEvent(eventEmitter, result2, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await glvUnwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
      expect(withdrawal.accountNumber).to.eq(ZERO_BI);
      expect(withdrawal.inputAmount).to.eq(ZERO_BI);
      expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
      expect(withdrawal.outputAmount).to.eq(ZERO_BI);
      expect(withdrawal.isRetryable).to.eq(false);
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        glvUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(BYTES_ZERO),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      const transaction = await glvUnwrapper.populateTransaction.executeWithdrawalForRetry(BYTES_ZERO);
      await expectThrow(
        glvUnwrapper.connect(core.hhUser1).callFunctionAndTriggerReentrancy(transaction.data!),
        'AsyncIsolationModeglvUnwrapperImpl: Reentrant call',
      );
    });

    it('should fail if withdrawal does not exist', async () => {
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await expectThrow(
        glvUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(BYTES_ZERO),
        'UpgradeableglvUnwrapperTraderV2: Invalid withdrawal key',
      );
    });

    it('should fail if the withdrawal cannot be retried', async () => {
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      const usdcAmount = BigNumber.from('600000');
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        TWO_BI,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const events = await eventEmitter.queryFilter(filter);
      const withdrawalKey = events[events.length - 1].args.key;

      await expectThrow(
        glvUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(withdrawalKey),
        'AsyncIsolationModeTraderBase: Conversion is not retryable',
      );
    });
  });

  describe('#callFunction', () => {
    it('should fail if account owner is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        glvUnwrapper
          .connect(dolomiteMarginCaller)
          .callFunction(
            core.hhUser5.address,
            { owner: core.hhUser2.address, number: defaultAccountNumber },
            encodeWithdrawalKeyForCallFunction(
              0,
              amountWei,
              core.hhUser2.address,
              defaultAccountNumber,
              UnwrapTradeType.ForWithdrawal,
              DUMMY_WITHDRAWAL_KEY,
            ),
          ),
        `AsyncIsolationModeglvUnwrapperImpl: Invalid vault <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if account owner is not the owner of a deposit / withdrawal', async () => {
      const vaultCaller = await impersonate(vault.address, true);
      await glvUnwrapper
        .connect(vaultCaller)
        .vaultCreateWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY,
          vault.address,
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          false,
          DEFAULT_EXTRA_DATA,
        );
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        glvUnwrapper
          .connect(dolomiteMarginCaller)
          .callFunction(
            core.hhUser5.address,
            { owner: vault2.address, number: defaultAccountNumber },
            encodeWithdrawalKeyForCallFunction(
              0,
              amountWei,
              vault2.address,
              defaultAccountNumber,
              UnwrapTradeType.ForWithdrawal,
              DUMMY_WITHDRAWAL_KEY,
            ),
          ),
        `AsyncIsolationModeglvUnwrapperImpl: Invalid account owner <${vault2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer amount is zero or gt withdrawal amount', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      const smallAmountWei = amountWei.div(2);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await glvUnwrapper
        .connect(vaultCaller)
        .vaultCreateWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY,
          vault.address,
          borrowAccountNumber,
          smallAmountWei,
          core.tokens.nativeUsdc.address,
          ONE_BI,
          false,
          DEFAULT_EXTRA_DATA,
        );

      await expectThrow(
        glvUnwrapper
          .connect(dolomiteMarginCaller)
          .callFunction(
            core.hhUser5.address,
            { owner: vault.address, number: defaultAccountNumber },
            encodeWithdrawalKeyForCallFunction(
              0,
              ZERO_BI,
              vault.address,
              defaultAccountNumber,
              UnwrapTradeType.ForWithdrawal,
              DUMMY_WITHDRAWAL_KEY,
            ),
          ),
        'AsyncIsolationModeglvUnwrapperImpl: Invalid transfer amount',
      );

      await expectThrow(
        glvUnwrapper
          .connect(dolomiteMarginCaller)
          .callFunction(
            core.hhUser5.address,
            { owner: vault.address, number: defaultAccountNumber },
            encodeWithdrawalKeyForCallFunction(
              0,
              smallAmountWei.add(1),
              vault.address,
              defaultAccountNumber,
              UnwrapTradeType.ForWithdrawal,
              DUMMY_WITHDRAWAL_KEY,
            ),
          ),
        'AsyncIsolationModeglvUnwrapperImpl: Invalid transfer amount',
      );
    });

    it('should fail if virtual underlying balance is insufficient', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);

      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await glvUnwrapper
        .connect(vaultCaller)
        .vaultCreateWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY,
          vault.address,
          borrowAccountNumber,
          amountWei,
          core.tokens.nativeUsdc.address,
          ONE_BI,
          false,
          DEFAULT_EXTRA_DATA,
        );

      await expectThrow(
        glvUnwrapper
          .connect(dolomiteMarginCaller)
          .callFunction(
            core.hhUser5.address,
            { owner: vault.address, number: defaultAccountNumber },
            encodeWithdrawalKeyForCallFunction(
              0,
              amountWei.add(1),
              vault.address,
              defaultAccountNumber,
              UnwrapTradeType.ForWithdrawal,
              DUMMY_WITHDRAWAL_KEY,
            ),
          ),
        `AsyncIsolationModeglvUnwrapperImpl: Insufficient balance <${amountWei.toString()}, ${amountWei
          .add(1)
          .toString()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should revert', async () => {
      await expectThrow(
        glvUnwrapper.getExchangeCost(factory.address, core.tokens.weth.address, wethAmount, BYTES_EMPTY),
        'GlvIsolationModeglvUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });

  describe('#createActionsForUnwrapping', () => {
    let withdrawalKey: string;

    beforeEach(async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        TWO_BI,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;
    });

    it('should not work if the input market is invalid', async () => {
      await expectThrow(
        glvUnwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeglvUnwrapperImpl: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should not work if the output market is invalid', async () => {
      await expectThrow(
        glvUnwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.dfsGlp,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeglvUnwrapperImpl: Invalid output market <${core.marketIds.dfsGlp.toString()}>`,
      );
    });

    it('should not work if the trade types and keys do not match in length', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [[UnwrapTradeType.ForWithdrawal, UnwrapTradeType.ForWithdrawal], [withdrawalKey], true],
      );
      await expectThrow(
        glvUnwrapper.createActionsForUnwrapping({
          orderData,
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
        }),
        'AsyncIsolationModeglvUnwrapperImpl: Invalid unwrapping order data',
      );
    });

    it('should not work if the input amount is 0', async () => {
      await expectThrow(
        glvUnwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: ZERO_BI,
          orderData: encodeWithdrawalKey(UnwrapTradeType.ForWithdrawal, withdrawalKey),
        }),
        'AsyncIsolationModeglvUnwrapperImpl: Invalid input amount',
      );
    });
  });
});
