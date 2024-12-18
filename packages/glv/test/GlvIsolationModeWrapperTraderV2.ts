import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from 'packages/base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
  expectWalletBalanceIsGreaterThan,
} from 'packages/base/test/utils/assertions';
import { createDolomiteRegistryImplementation } from 'packages/base/test/utils/dolomite';
import {
  disableInterestAccrual,
  getDefaultProtocolConfigForGlv,
  setupCoreProtocol,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { GLV_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { IGmxMarketToken, TestOracleProvider, TestOracleProvider__factory } from 'packages/gmx-v2/src/types';
import { createGmxV2Library, getOracleProviderEnabledKey } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { IChaosLabsPriceOracleV3 } from 'packages/oracles/src/types';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeWrapperTraderV2,
  GlvRegistry,
  IEventEmitterRegistry,
  IGlvToken,
  IGmxRoleStore__factory,
  TestGlvIsolationModeVaultFactory,
} from '../src/types';
import {
  createGlvIsolationModeUnwrapperTraderV2,
  createGlvIsolationModeWrapperTraderV2,
  createGlvLibrary,
  createGlvRegistry,
  createGlvTokenPriceOracle,
  createTestGlvIsolationModeTokenVaultV1,
  createTestGlvIsolationModeVaultFactory,
  getGlvDepositObject,
  getGlvOracleParams,
  getInitiateWrappingParams,
  setupNewOracleAggregatorTokens,
} from './glv-ecosystem-utils';

enum ReversionType {
  None = 0,
  Assert = 1,
  Require = 2,
}

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const usdcAmount = BigNumber.from('1000000000'); // $1,000
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const minAmountOut = parseEther('100');

const executionFee =
  process.env.COVERAGE !== 'true' ? GLV_EXECUTION_FEE_FOR_TESTS : GLV_EXECUTION_FEE_FOR_TESTS.mul(10);
const gasLimit = process.env.COVERAGE !== 'true' ? 30_000_000 : 100_000_000; // @follow-up Check if this is ok
const callbackGasLimit =
  process.env.COVERAGE !== 'true' ? BigNumber.from('4000000') : BigNumber.from('4000000').mul(10);

describe('GlvIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGlvToken;
  let gmMarketToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let glvRegistry: GlvRegistry;
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let factory: TestGlvIsolationModeVaultFactory;
  let vault: GlvIsolationModeTokenVaultV1;
  let priceOracle: IChaosLabsPriceOracleV3;
  let eventEmitter: IEventEmitterRegistry;
  let marketId: BigNumber;
  let testOracleProvider: TestOracleProvider;
  let controller: SignerWithAddressWithSafety;
  let EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED_KEY: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultProtocolConfigForGlv());
    eventEmitter = core.eventEmitterRegistry;
    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken.connect(core.hhUser1);
    gmMarketToken = core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken;

    EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED_KEY = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'address'],
        [
          ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(['string'], ['EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED']),
          ),
          core.glvEcosystem.glvHandler.address,
        ],
      ),
    );

    const glvLibrary = await createGlvLibrary();
    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createTestGlvIsolationModeTokenVaultV1(core);
    glvRegistry = await createGlvRegistry(core, callbackGasLimit);
    await glvRegistry
      .connect(core.governance)
      .ownerSetGlvTokenToGmMarketForDeposit(underlyingToken.address, gmMarketToken.address);
    await glvRegistry
      .connect(core.governance)
      .ownerSetGlvTokenToGmMarketForWithdrawal(underlyingToken.address, gmMarketToken.address);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);

    await setupNewOracleAggregatorTokens(core);

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

    allowableMarketIds = [core.marketIds.nativeUsdc, core.marketIds.weth];
    factory = await createTestGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem.glvTokens.wethUsdc,
      userVaultImplementation,
      executionFee,
    );
    unwrapper = await createGlvIsolationModeUnwrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);
    wrapper = await createGlvIsolationModeWrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);

    priceOracle = await createGlvTokenPriceOracle(core, [factory]);
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: factory.address,
      decimals: await factory.decimals(),
      oracleInfos: [
        {
          oracle: priceOracle.address,
          weight: 100,
          tokenPair: ADDRESS_ZERO,
        },
      ],
    });

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, core.oracleAggregatorV2);

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GlvIsolationModeTokenVaultV1>(
      vaultAddress,
      GlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    await setEtherBalance(core.gmxV2Ecosystem.gmxExecutor.address, parseEther('100'));

    await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await glvRegistry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);
    await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await wrapper.GLV_REGISTRY()).to.eq(glvRegistry.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        wrapper.initialize(factory.address, core.dolomiteMargin.address, glvRegistry.address, false),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#initiateWrapping', () => {
    it('should work normally with long token', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        marketId,
        minAmountOut,
        wrapper,
      );
      await vault.swapExactInputForOutput(
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
    });

    it('should work normally with short token', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        marketId,
        minAmountOut,
        wrapper,
      );
      await vault.swapExactInputForOutput(
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
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail if execute deposit feature is disabled', async () => {
      await core.gmxV2Ecosystem.gmxDataStore
        .connect(controller)
        .setBool(EXECUTE_GLV_DEPOSIT_FEATURE_DISABLED_KEY, true);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        marketId,
        minAmountOut,
        wrapper,
      );
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: executionFee },
        ),
        'GlvLibrary: Execute deposit feature disabled',
      );
    });
  });

  describe('#afterDepositExecution', () => {
    let depositKey: string;

    async function setupBalances(
      inputMarketId: BigNumberish,
      inputAmount: BigNumberish,
      minAmountOut: BigNumberish,
      beforeInitiatingHook: () => Promise<void> = async () => {},
    ) {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        inputMarketId,
        inputAmount,
        BalanceCheckFlag.Both,
      );
      await beforeInitiatingHook();
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        inputMarketId,
        inputAmount,
        marketId,
        minAmountOut,
        wrapper,
      );
      const result = await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: executionFee },
      );

      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, result.blockHash))[0].args;
      depositKey = eventArgs.key;
      expect(eventArgs.token).to.eq(factory.address);

      const deposit = await wrapper.getDepositInfo(depositKey);
      expect(deposit.key).to.eq(depositKey);
      expect(deposit.vault).to.eq(vault.address);
      expect(deposit.accountNumber).to.eq(borrowAccountNumber);
      expect(deposit.outputAmount).to.eq(minAmountOut);
      expect(deposit.isRetryable).to.eq(false);
      expect(eventArgs.deposit.key).to.eq(depositKey);
      expect(eventArgs.deposit.vault).to.eq(vault.address);
      expect(eventArgs.deposit.accountNumber).to.eq(borrowAccountNumber);
      expect(eventArgs.deposit.outputAmount).to.eq(minAmountOut);
      expect(eventArgs.deposit.isRetryable).to.eq(false);

      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);
      expect(await factory.getPendingAmountByAccount(vault.address, borrowAccountNumber, FreezeType.Deposit)).to.eq(
        initiateWrappingParams.minAmountOut,
      );
    }

    async function expectStateIsCleared() {
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
    }

    it('should work normally with long token', async () => {
      const minAmountOut = parseEther('1000');
      await setupBalances(core.marketIds.weth, ONE_ETH_BI, minAmountOut);
      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositExecuted', {
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
      await expectStateIsCleared();
    });

    it('should work normally with short token', async () => {
      const minAmountOut = parseEther('777');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut);

      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositExecuted', {
        key: depositKey,
        token: factory.address,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        minAmountOut,
        10,
      );
      expect(await underlyingToken.balanceOf(vault.address)).to.be.gte(minAmountOut);
      await expectStateIsCleared();
    });

    it('should work normally when execute deposit fails on GMX side', async () => {
      const minAmountOut = parseEther('777');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut);

      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      // @oriole - Why is this supposed to fail?
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      await expectStateIsCleared();
    });

    it('should work when deposit will fail because of max supply wei (sends diff to vault owner)', async () => {
      const minAmountOut = parseEther('10');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      await core.dolomiteMargin.ownerSetMaxWei(marketId, ONE_BI);
      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositFailed', {
        key: depositKey,
        token: factory.address,
        reason: `OperationImpl: Total supply exceeds max supply <${marketId.toString()}>`,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, minAmountOut);
      // The vault should only hold the min
      await expectWalletBalance(vault, underlyingToken, minAmountOut);
      // The owner should hold anything extra (beyond the min)
      await expectWalletBalanceIsGreaterThan(core.hhUser1, underlyingToken, ONE_BI);
      await expectStateIsCleared();
    });

    it('should work when deposit partially fills because max supply wei (sends diff to vault owner)', async () => {
      const minAmountOut = parseEther('100');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      const ethDiff = parseEther('50');
      await core.dolomiteMargin.ownerSetMaxWei(marketId, minAmountOut.add(ethDiff));
      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositFailed', {
        key: depositKey,
        token: factory.address,
        reason: `OperationImpl: Total supply exceeds max supply <${marketId.toString()}>`,
      });

      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ethDiff);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, minAmountOut);
      // The vault should only hold the min
      await expectWalletBalance(vault, underlyingToken, minAmountOut.add(ethDiff));
      // The owner should hold anything extra (beyond the min)
      await expectWalletBalanceIsGreaterThan(core.hhUser1, underlyingToken, ONE_BI);
      await expectStateIsCleared();
    });

    it('should work when deposit fails due to insufficient collateralization', async () => {
      const minAmountOut = parseEther('100');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut, async () => {
        const borrowAmount = parseEther('.02');
        await vault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          borrowAmount,
          BalanceCheckFlag.To,
        );
      });

      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI); // as close to 0 as possible
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncDepositFailed', {
        key: depositKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: defaultAccountNumber },
        marketId,
        ONE_BI,
        0,
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, minAmountOut);
      expect(await underlyingToken.balanceOf(vault.address)).to.be.gte(minAmountOut);
      await expectStateIsCleared();
    });

    it('should work when deposit fails due to reversion', async () => {
      const minAmountOut = parseEther('100');
      await setupBalances(core.marketIds.nativeUsdc, usdcAmount, minAmountOut);

      await factory.setReversionType(ReversionType.Assert);
      const result = await core.glvEcosystem.glvHandler
        .connect(core.gmxV2Ecosystem.gmxExecutor)
        .executeGlvDeposit(
          depositKey,
          await getGlvOracleParams(core, controller, core.glvEcosystem.glvTokens.wethUsdc, testOracleProvider),
          { gasLimit },
        );

      await expectEvent(eventEmitter, result, 'AsyncDepositFailed', {
        key: depositKey,
        token: factory.address,
        reason: '',
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: defaultAccountNumber },
        marketId,
        ONE_BI,
        0,
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, minAmountOut);
      expect(await underlyingToken.balanceOf(vault.address)).to.be.gte(minAmountOut);
      await expectStateIsCleared();
    });

    it('should work when received market tokens equals min market tokens', async () => {
      const minAmountOut = parseEther('.003');
      await setupBalances(core.marketIds.weth, ONE_ETH_BI, minAmountOut);

      await setupGMBalance(core, underlyingToken, await impersonate(wrapper.address, true), minAmountOut);
      const depositExecutor = await impersonate(core.glvEcosystem.glvHandler.address, true);
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        minAmountOut,
        executionFee,
        minAmountOut,
      );
      const result = await wrapper
        .connect(depositExecutor)
        .afterGlvDepositExecution(depositKey, depositInfo.deposit, depositInfo.eventData);
      await expectEvent(eventEmitter, result, 'AsyncDepositExecuted', {
        key: depositKey,
        token: factory.address,
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      await expectWalletBalance(vault.address, underlyingToken, minAmountOut);
      await expectStateIsCleared();
    });

    it('should fail if eventData is not crafted properly', async () => {
      const minAmountOut = parseEther('.003');
      await setupBalances(core.marketIds.weth, ONE_ETH_BI, minAmountOut);

      await setupGMBalance(core, underlyingToken, await impersonate(wrapper.address, true), minAmountOut, vault);
      const depositExecutor = await impersonate(core.glvEcosystem.glvHandler.address, true);
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        minAmountOut,
        executionFee,
        minAmountOut,
      );
      depositInfo.eventData.uintItems.items[0].key = 'receivedBadTokens';
      await expectThrow(
        wrapper
          .connect(depositExecutor)
          .afterGlvDepositExecution(depositKey, depositInfo.deposit, depositInfo.eventData),
        'GlvIsolationModeWrapperV2: Unexpected receivedGlvTokens',
      );
    });

    it('should fail when not called by deposit handler', async () => {
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        ONE_BI,
        executionFee,
      );
      await expectThrow(
        wrapper
          .connect(core.hhUser1)
          .afterGlvDepositExecution(DUMMY_DEPOSIT_KEY, depositInfo.deposit, depositInfo.eventData),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when deposit was not created through wrapper', async () => {
      const depositExecutor = await impersonate(core.glvEcosystem.glvHandler.address, true);
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        ONE_BI,
        executionFee,
        ONE_BI,
      );
      await expectThrow(
        wrapper
          .connect(depositExecutor)
          .afterGlvDepositExecution(DUMMY_DEPOSIT_KEY, depositInfo.deposit, depositInfo.eventData),
        'UpgradeableWrapperTraderV2: Invalid deposit key',
      );
    });
  });

  describe('#afterDepositCancellation', () => {
    it('should work normally for account number 0', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);

      const wethBalanceBefore = await core.tokens.weth.balanceOf(core.dolomiteMargin.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        defaultAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        marketId,
        minAmountOut,
        wrapper,
      );
      const res = await vault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        defaultAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: executionFee },
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, minAmountOut);
      expect(await vault.virtualBalance()).to.eq(minAmountOut);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);
      const depositKey = eventArgs.key;
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });

      expect(await core.tokens.weth.balanceOf(core.dolomiteMargin.address)).to.eq(wethBalanceBefore);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, 0);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectEmptyDepositInfo(depositKey);
    });

    it('should work normally with long token', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      const wethBalanceBefore = await core.tokens.weth.balanceOf(core.dolomiteMargin.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
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

      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, minAmountOut);
      expect(await vault.virtualBalance()).to.eq(minAmountOut);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);
      const depositKey = eventArgs.key;
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });

      expect(await core.tokens.weth.balanceOf(core.dolomiteMargin.address)).to.eq(wethBalanceBefore);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 0);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectEmptyDepositInfo(depositKey);
    });

    it('should work normally with short token', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      const usdcBalanceBefore = await core.tokens.nativeUsdc.balanceOf(core.dolomiteMargin.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
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

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);
      const depositKey = eventArgs.key;
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });

      expect(await core.tokens.nativeUsdc.balanceOf(core.dolomiteMargin.address)).to.eq(usdcBalanceBefore);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 0);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await expectEmptyDepositInfo(depositKey);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail when not called by deposit handler', async () => {
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        ONE_BI,
        executionFee,
      );
      await expectThrow(
        wrapper
          .connect(core.hhUser1)
          .afterGlvDepositCancellation(DUMMY_DEPOSIT_KEY, depositInfo.deposit, depositInfo.eventData),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when deposit was not created through wrapper', async () => {
      const depositExecutor = await impersonate(core.glvEcosystem.glvHandler.address, true);
      const depositInfo = getGlvDepositObject(
        wrapper.address,
        underlyingToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        core.tokens.weth.address,
        core.tokens.nativeUsdc.address,
        ONE_ETH_BI,
        ZERO_BI,
        ONE_BI,
        executionFee,
      );
      await expectThrow(
        wrapper
          .connect(depositExecutor)
          .afterGlvDepositCancellation(DUMMY_DEPOSIT_KEY, depositInfo.deposit, depositInfo.eventData),
        'UpgradeableWrapperTraderV2: Invalid deposit key',
      );
    });

    it('should handle error when the callback throws with DolomiteMargin', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both,
      );
      const wethAmount = parseEther('0.01');
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount.mul(-1));

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
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

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);
      const depositKey = eventArgs.key;
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      // Set the value of the USDC collateral to 0. When the deposit is cancelled, it'll fail
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.nativeUsdc.address, ONE_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(
        core.marketIds.nativeUsdc,
        core.testEcosystem!.testPriceOracle.address,
      );

      // Mine blocks, so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelledFailed', {
        key: depositKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber}>`,
      });
    });
  });

  describe('#initiateCancelDeposit', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
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

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      const depositKey = eventArgs.key;
      expect(eventArgs.token).to.eq(factory.address);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });
      await expectEmptyDepositInfo(depositKey);
    });

    it('should work normally when called by valid handler', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
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

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      const depositKey = eventArgs.key;
      expect(eventArgs.token).to.eq(factory.address);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await wrapper.connect(core.hhUser5).initiateCancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });
    });

    it('should fail if not called by deposit creator (vault)', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
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

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      const depositKey = eventArgs.key;
      expect(eventArgs.token).to.eq(factory.address);

      await expectThrow(
        wrapper.connect(core.hhUser1).initiateCancelDeposit(depositKey),
        'GlvLibrary: Only vault or handler can cancel',
      );
    });
  });

  describe('#executeDepositCancellationForRetry', () => {
    it('should work normally', async () => {
      const minAmountOut = parseEther('77');
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both,
      );
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.div(10),
        BalanceCheckFlag.None,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.div(10),
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

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        ZERO_BI.sub(usdcAmount.div(5)),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);

      const filter = eventEmitter.filters.AsyncDepositCreated();
      const eventArgs = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);
      const depositKey = eventArgs.key;

      const oldOracle = await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth);
      const price = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, price.div(100));
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelledFailed', {
        key: depositKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });

      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, oldOracle);

      const result2 = await wrapper.connect(core.hhUser1).executeDepositCancellationForRetry(depositKey, { gasLimit });
      await expectEvent(eventEmitter, result2, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
      });

      const deposit = await wrapper.getDepositInfo(depositKey);
      expect(deposit.vault).to.eq(ZERO_ADDRESS);
      expect(deposit.accountNumber).to.eq(ZERO_BI);
      expect(deposit.inputToken).to.eq(ZERO_ADDRESS);
      expect(deposit.inputAmount).to.eq(ZERO_BI);
      expect(deposit.outputAmount).to.eq(ZERO_BI);
      expect(deposit.isRetryable).to.eq(false);

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        ZERO_BI.sub(usdcAmount.div(10)).sub(1),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
    });

    it('should fail if not called by a handler', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).executeDepositCancellationForRetry(BYTES_ZERO),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if the deposit is not retryable yet', async () => {
      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await expectThrow(
        wrapper.connect(core.hhUser1).executeDepositCancellationForRetry(BYTES_ZERO),
        'AsyncIsolationModeTraderBase: Conversion is not retryable',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work normally', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.weth.address)).to.eq(true);
      expect(await wrapper.isValidInputToken(core.tokens.nativeUsdc.address)).to.eq(true);
    });

    it('should fail if token is not one of two assets in LP', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.wbtc.address)).to.eq(false);
      expect(await wrapper.isValidInputToken(core.hhUser1.address)).to.eq(false);
    });
  });

  describe('#exchange', () => {
    it('should fail if the vault account is frozen', async () => {
      const amountWei = parseEther('0.01');
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        ONE_BI,
        wrapper,
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: executionFee },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ONE_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      const wrapperImpersonator = await impersonate(wrapper.address, true);
      await expectThrow(
        vault
          .connect(wrapperImpersonator)
          .swapExactInputForOutput(
            borrowAccountNumber,
            initiateWrappingParams.marketPath,
            initiateWrappingParams.amountIn,
            initiateWrappingParams.minAmountOut,
            initiateWrappingParams.traderParams,
            initiateWrappingParams.makerAccounts,
            initiateWrappingParams.userConfig,
            { value: executionFee },
          ),
        `UpgradeableWrapperTraderV2: Vault is frozen <${vault.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.nativeUsdc.address, factory.address, ONE_ETH_BI, BYTES_EMPTY),
        'GlvIsolationModeWrapperV2: getExchangeCost is not implemented',
      );
    });
  });

  describe('#setDepositInfoAndReducePendingAmountFromUnwrapper', () => {
    it('should fail when caller is not unwrapper', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).setDepositInfoAndReducePendingAmountFromUnwrapper(DUMMY_DEPOSIT_KEY, ONE_ETH_BI, {
          key: DUMMY_DEPOSIT_KEY,
          vault: vault.address,
          accountNumber: defaultAccountNumber,
          inputAmount: ONE_ETH_BI,
          inputToken: core.tokens.weth.address,
          outputAmount: ONE_ETH_BI,
          isRetryable: false,
        }),
        `UpgradeableWrapperTraderV2: Only unwrapper can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  async function expectEmptyDepositInfo(key: string) {
    const deposit = await wrapper.getDepositInfo(key);
    expect(deposit.key).to.eq(BYTES_ZERO);
    expect(deposit.vault).to.eq(ZERO_ADDRESS);
    expect(deposit.accountNumber).to.eq(ZERO_BI);
    expect(deposit.inputToken).to.eq(ZERO_ADDRESS);
    expect(deposit.inputAmount).to.eq(ZERO_BI);
    expect(deposit.outputAmount).to.eq(ZERO_BI);
  }
});
