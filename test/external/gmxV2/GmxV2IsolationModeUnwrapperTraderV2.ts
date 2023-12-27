import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import {
  EventEmitterRegistry,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2MarketTokenPriceOracle,
  GmxV2Registry,
  IERC20,
  IGmxMarketToken,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeTokenVaultV1__factory,
  TestGmxV2IsolationModeUnwrapperTraderV2,
} from 'src/types';
import { depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { BYTES_EMPTY, BYTES_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from 'test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from 'test/utils/assertions';
import {
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2MarketTokenPriceOracle,
  createGmxV2Registry,
  createTestGmxV2IsolationModeTokenVaultV1,
  createTestGmxV2IsolationModeUnwrapperTraderV2,
  getOracleParams,
  getWithdrawalObject,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'test/utils/setup';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';
import { createDolomiteRegistryImplementation, createEventEmitter } from '../../utils/dolomite';
import { createSafeDelegateLibrary } from '../../utils/ecosystem-token-utils/general';

enum ReversionType {
  None = 0,
  Assert = 1,
  Require = 2,
}

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const usdcAmount = BigNumber.from('1000000000'); // $1000
const amountWei = parseEther('10');
const ONE_BI_ENCODED = '0x0000000000000000000000000000000000000000000000000000000000000001';

const executionFee = process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE : GMX_V2_EXECUTION_FEE.mul(10);
const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const callbackGasLimit = process.env.COVERAGE !== 'true'
  ? GMX_V2_CALLBACK_GAS_LIMIT
  : GMX_V2_CALLBACK_GAS_LIMIT.mul(10);

enum UnwrapTradeType {
  ForWithdrawal = 0,
  ForDeposit = 1,
}

function encodeWithdrawalKey(tradeType: UnwrapTradeType, key: string): string {
  return ethers.utils.defaultAbiCoder.encode(['uint8[]', 'bytes32[]'], [[tradeType], [key]]);
}

function encodeWithdrawalKeyForCallFunction(
  transferAmount: BigNumberish,
  accountOwner: string,
  accountNumber: BigNumberish,
  tradeType: UnwrapTradeType,
  key: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'uint8[]', 'bytes32[]'], [transferAmount, accountOwner, accountNumber, [tradeType], [key]]);
}

describe('GmxV2IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let gmxV2Registry: GmxV2Registry;
  let unwrapper: TestGmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: TestGmxV2IsolationModeTokenVaultV1;
  let vault2: TestGmxV2IsolationModeTokenVaultV1;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let eventEmitter: EventEmitterRegistry;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const gmxV2Library = await createGmxV2Library();
    const safeDelegateCallLibrary = await createSafeDelegateLibrary();
    const userVaultImplementation = await createTestGmxV2IsolationModeTokenVaultV1(
      core,
    );
    gmxV2Registry = await createGmxV2Registry(core, callbackGasLimit);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxV2Library,
      gmxV2Registry,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    unwrapper = await createTestGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      safeDelegateCallLibrary,
      gmxV2Registry,
    );
    priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxV2Registry);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    await factory.createVault(core.hhUser2.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    const vaultAddress2 = await factory.getVaultByAccount(core.hhUser2.address);
    vault = setupUserVaultProxy<TestGmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      TestGmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    vault2 = setupUserVaultProxy<TestGmxV2IsolationModeTokenVaultV1>(
      vaultAddress2,
      TestGmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser2,
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
    await setEtherBalance(core.gmxEcosystemV2!.gmxExecutor.address, parseEther('100'));

    await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    eventEmitter = await createEventEmitter(core);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetGenericTraderProxy(core.genericTraderProxy!.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.genericTraderProxy!.address, true);
    await core.genericTraderProxy!.connect(core.governance).ownerSetEventEmitterRegistry(eventEmitter.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await unwrapper.GMX_REGISTRY_V2()).to.eq(gmxV2Registry.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        unwrapper.initialize(
          factory.address,
          core.dolomiteMargin.address,
          gmxV2Registry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#initiateCancelWithdrawal', () => {
    it('should work when called by vault', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await vault.cancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should work when called by a handler', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await unwrapper.connect(core.hhUser1).initiateCancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail when not called by a vault or handler', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).initiateCancelWithdrawal(DUMMY_WITHDRAWAL_KEY),
        'GmxV2Library: Only vault or handler can cancel',
      );
    });
  });

  describe('#exchange', () => {

    let withdrawalKey: string;

    beforeEach(async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is invalid', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbtc.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.wbtc.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token does not match withdrawal struct', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.nativeUsdc!.address,
          factory.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [ONE_BI, encodeWithdrawalKey(UnwrapTradeType.ForWithdrawal, withdrawalKey)],
          ),
        ),
        'AsyncIsolationModeUnwrapperImpl: Output token mismatch',
      );
    });

    it('should fail if input amount is insufficient', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        'UpgradeableUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#handleCallbackFromWrapperBefore', () => {
    it('should work when called by wrapper', async () => {
      expect(await unwrapper.actionsLength()).to.eq(4);

      const impersonator = await impersonate(wrapper.address, true);
      await unwrapper.connect(impersonator).handleCallbackFromWrapperBefore();

      expect(await unwrapper.actionsLength()).to.eq(2);
    });

    it('should fail when not called by wrapper', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).handleCallbackFromWrapperBefore(),
        `GmxV2IsolationModeUnwrapperV2: Caller can only be wrapper <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#handleCallbackFromWrapperAfter', () => {
    it('should work when called by wrapper', async () => {
      expect(await unwrapper.actionsLength()).to.eq(4);

      const impersonator = await impersonate(wrapper.address, true);
      await unwrapper.connect(impersonator).handleCallbackFromWrapperBefore();
      expect(await unwrapper.actionsLength()).to.eq(2);

      await unwrapper.connect(impersonator).handleCallbackFromWrapperAfter();
      expect(await unwrapper.actionsLength()).to.eq(4);
    });

    it('should fail when not called by wrapper', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).handleCallbackFromWrapperAfter(),
        `GmxV2IsolationModeUnwrapperV2: Caller can only be wrapper <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#afterWithdrawalCancellation', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await vault.connect(core.hhUser1).cancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should work normally when execution fails because minAmountOut is too large', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        MAX_UINT_256_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    });

    it('should work normally when execution fails because minAmountOutShort is too large', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ethers.utils.defaultAbiCoder.encode(['uint256'], [MAX_UINT_256_BI]),
        { value: executionFee },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    });

    it('should fail when not called by valid handler', async () => {
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        executionFee,
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when withdrawal was not created through token vault', async () => {
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        executionFee,
        core.tokens.weth.address,
        core.tokens.nativeUsdc!.address,
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'UpgradeableUnwrapperTraderV2: Invalid withdrawal key',
      );
    });

    // @todo fix
    it('should fail if reentered', async () => {
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        executionFee,
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      const transaction = await unwrapper.populateTransaction.afterWithdrawalCancellation(
        DUMMY_WITHDRAWAL_KEY,
        withdrawalInfo.withdrawal,
        withdrawalInfo.eventData,
      );
      await expectThrow(
        unwrapper.callFunctionAndTriggerReentrancy(transaction.data!),
        'AsyncIsolationModeUnwrapperImpl: Reentrant call',
      );
    });
  });

  describe.only('#afterWithdrawalExecution', () => {
    let withdrawalKey: string;

    async function setupBalances(outputToken: IERC20) {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

      const minAmountOut = ONE_BI;
      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        outputToken.address,
        minAmountOut,
        ONE_BI_ENCODED,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;
      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
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

    // @todo fix
    it('should work normally with actual oracle params and long token', async () => {
      await setupBalances(core.tokens.weth);
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      // @follow-up changed this
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
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    // @todo fix
    it('should work normally with actual oracle params and short token', async () => {
      await setupBalances(core.tokens.nativeUsdc!);
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
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
        core.marketIds.nativeUsdc!,
        '1000000', // $1.00
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

      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: '',
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      // This invariant only works because we don't have multiple failed swaps stuck in the unwrapper at the moment
      const withdrawalInfo = await unwrapper.getWithdrawalInfo(withdrawalKey);
      await expectWalletBalance(unwrapper, core.tokens.weth, withdrawalInfo.outputAmount);
    });

    it('should work normally with swap fails due to reversion with a message', async () => {
      await setupBalances(core.tokens.weth);
      await vault.setReversionType(ReversionType.Require);
      expect(await vault.reversionType()).to.eq(ReversionType.Require);

      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: 'Reverting',
      });

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      // This invariant only works because we don't have multiple failed swaps stuck in the unwrapper at the moment
      const withdrawalInfo = await unwrapper.getWithdrawalInfo(withdrawalKey);
      await expectWalletBalance(unwrapper, core.tokens.weth, withdrawalInfo.outputAmount);
    });

    // @todo fix
    it('should work normally if user sends extra amount to withdrawal vault', async () => {
      await setupGMBalance(core, core.gmxEcosystemV2!.gmxWithdrawalVault, ONE_BI);
      await setupBalances(core.tokens.weth);
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      // @follow-up changed this
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
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

    });

    // This POC from Guardian now fails
    xit('Send 1 Wei to Withdrawal Vault to Revert On afterWithdrawalExecution Validation', async () => {
      // Send 1 wei of GM to withdrawal vault prior to initiating a withdrawal
      await setupGMBalance(core, core.gmxEcosystemV2?.gmxWithdrawalVault!, 1);
      // A withdrawal for amountWei + 1 is created
      await setupBalances(core.tokens.nativeUsdc!);
      // The protocol has amountWei GM prior to withdrawal execution
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        marketId,
        amountWei
      );
      // There is no USDC in the Unwrapper
      expect(await core.tokens.nativeUsdc!.balanceOf(unwrapper.address)).to.eq(0);

      const result = await core
        .gmxEcosystemV2!.gmxWithdrawalHandler.connect(
          core.gmxEcosystemV2!.gmxExecutor
        )
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(
            core.tokens.weth.address,
            core.tokens.nativeUsdc!.address
          ),
          { gasLimit: 10_000_000 }
        );

      // Withdrawal info object remains and is uncleared
      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(core.tokens.nativeUsdc!.address);
      expect(withdrawal.outputAmount).to.eq(ONE_BI);

      // The protocol STILL has amountWei GM after withdrawal execution
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        marketId,
        amountWei
      );
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI
      );
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        ZERO_BI
      );

      // Vault remains frozen, prohibiting user actions
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Funds are stuck in the Unwrapper
      expect(await core.tokens.nativeUsdc!.balanceOf(unwrapper.address)).to.be.gt(0);
    });

    it('should fail if given invalid event data', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const unwrapperImpersonate = await impersonate(unwrapper.address, true);
      await setupNativeUSDCBalance(core, unwrapperImpersonate, 100e6, core.gmxEcosystem!.esGmxDistributorForStakedGlp);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
        BigNumber.from('100000000'),
      );

      withdrawalInfo.eventData.addressItems.items[0].key = 'badOutputToken';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2Library: Unexpected outputToken',
      );

      withdrawalInfo.eventData.addressItems.items[0].key = 'outputToken';
      withdrawalInfo.eventData.addressItems.items[1].key = 'badSecondaryOutputToken';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2Library: Unexpected secondaryOutputToken',
      );

      withdrawalInfo.eventData.addressItems.items[1].key = 'secondaryOutputToken';
      withdrawalInfo.eventData.uintItems.items[0].key = 'badOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2Library: Unexpected outputAmount',
      );

      withdrawalInfo.eventData.uintItems.items[0].key = 'outputAmount';
      withdrawalInfo.eventData.uintItems.items[1].key = 'badSecondaryOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2Library: Unexpected secondaryOutputAmount',
      );
    });

    // @todo Confirm that we can then withdraw the tokens
    xit('should fail if more than one output token received', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const unwrapperImpersonate = await impersonate(unwrapper.address, true);
      await setupNativeUSDCBalance(core, unwrapperImpersonate, 100e6, core.gmxEcosystem!.esGmxDistributorForStakedGlp);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
        BigNumber.from('100000000'),
        BigNumber.from('100000000'),
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2Library: Can only receive one token',
      );
    });

    it('should fail when not called by valid handler', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when withdrawal was not created through token vault', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.weth.address,
        core.tokens.nativeUsdc!.address,
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'UpgradeableUnwrapperTraderV2: Invalid withdrawal key',
      );
    });

    it('should not fail when withdrawal amount is more than expected', async () => {
      await setupBalances(core.tokens.weth);

      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei.add(1),
        parseEther('.01'),
        core.tokens.weth.address,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI,
      );
      await unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
        withdrawalKey,
        withdrawalInfo.withdrawal,
        withdrawalInfo.eventData,
      );
    });

    it('should fail if reentered', async () => {
      const withdrawalInfo = getWithdrawalObject(
        unwrapper.address,
        underlyingToken.address,
        ONE_BI,
        ONE_BI,
        amountWei,
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      const transaction = await unwrapper.populateTransaction.afterWithdrawalExecution(
        DUMMY_WITHDRAWAL_KEY,
        withdrawalInfo.withdrawal,
        withdrawalInfo.eventData,
      );
      await expectThrow(
        unwrapper.callFunctionAndTriggerReentrancy(transaction.data!),
        'AsyncIsolationModeUnwrapperImpl: Reentrant call',
      );
    });
  });

  describe('#executeWithdrawalForRetry', () => {
    it('should work normally', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      const usdcAmount = BigNumber.from('1000000');
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      const minAmountOut = ONE_BI;
      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        minAmountOut,
        ONE_BI_ENCODED,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const oldOracle = await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
        );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber}>`,
      });

      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, oldOracle);

      const result2 = await unwrapper.connect(core.hhUser1).executeWithdrawalForRetry(
        withdrawalKey,
        { gasLimit },
      );
      await expectEvent(eventEmitter, result2, 'AsyncWithdrawalExecuted', {
        key: withdrawalKey,
        token: factory.address,
      });

      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
      expect(withdrawal.accountNumber).to.eq(ZERO_BI);
      expect(withdrawal.inputAmount).to.eq(ZERO_BI);
      expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
      expect(withdrawal.outputAmount).to.eq(ZERO_BI);
      expect(withdrawal.isRetryable).to.eq(false);
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).executeWithdrawalForRetry(BYTES_ZERO),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      const transaction = await unwrapper.populateTransaction.executeWithdrawalForRetry(BYTES_ZERO);
      await expectThrow(
        unwrapper.connect(core.hhUser1).callFunctionAndTriggerReentrancy(transaction.data!),
        'AsyncIsolationModeUnwrapperImpl: Reentrant call',
      );
    });

    it('should fail if withdrawal does not exist', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await expectThrow(
        unwrapper.connect(core.hhUser1).executeWithdrawalForRetry(BYTES_ZERO),
        'UpgradeableUnwrapperTraderV2: Invalid withdrawal key',
      );
    });

    it('should fail if the withdrawal cannot be retried', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      const usdcAmount = BigNumber.from('5000000');
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectThrow(
        unwrapper.connect(core.hhUser1).executeWithdrawalForRetry(withdrawalKey),
        'AsyncIsolationModeTraderBase: Conversion is not retryable',
      );
    });
  });

  describe('#callFunction', () => {
    it('should fail if account owner is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          encodeWithdrawalKeyForCallFunction(amountWei, core.hhUser2.address, defaultAccountNumber, UnwrapTradeType.ForWithdrawal, DUMMY_WITHDRAWAL_KEY),
        ),
        `AsyncIsolationModeUnwrapperImpl: Invalid vault <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if account owner is not the owner of a deposit / withdrawal', async () => {
      const vaultCaller = await impersonate(vault.address, true);
      await unwrapper.connect(vaultCaller).vaultCreateWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        vault.address,
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        false,
        ONE_BI_ENCODED,
      );
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault2.address, number: defaultAccountNumber },
          encodeWithdrawalKeyForCallFunction(amountWei, vault2.address, defaultAccountNumber, UnwrapTradeType.ForWithdrawal, DUMMY_WITHDRAWAL_KEY),
        ),
        `AsyncIsolationModeUnwrapperImpl: Invalid account owner <${vault2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer amount is zero or gt withdrawal amount', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );

      const smallAmountWei = amountWei.div(2);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await unwrapper.connect(vaultCaller).vaultCreateWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        vault.address,
        borrowAccountNumber,
        smallAmountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        false,
        ONE_BI_ENCODED,
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          encodeWithdrawalKeyForCallFunction(ZERO_BI, vault.address, defaultAccountNumber, UnwrapTradeType.ForWithdrawal, DUMMY_WITHDRAWAL_KEY),
        ),
        'AsyncIsolationModeUnwrapperImpl: Invalid transfer amount',
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          encodeWithdrawalKeyForCallFunction(
            smallAmountWei.add(1),
            vault.address,
            defaultAccountNumber,
            UnwrapTradeType.ForWithdrawal,
            DUMMY_WITHDRAWAL_KEY,
          ),
        ),
        'AsyncIsolationModeUnwrapperImpl: Invalid transfer amount',
      );
    });

    it('should fail if virtual underlying balance is insufficient', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);

      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await unwrapper.connect(vaultCaller).vaultCreateWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        vault.address,
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        false,
        ONE_BI_ENCODED,
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          encodeWithdrawalKeyForCallFunction(amountWei.add(1), vault.address, defaultAccountNumber, UnwrapTradeType.ForWithdrawal, DUMMY_WITHDRAWAL_KEY),
        ),
        `AsyncIsolationModeUnwrapperImpl: Insufficient balance <${amountWei.toString()}, ${amountWei.add(1).toString()}>`,
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should revert', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(factory.address, core.tokens.weth.address, ONE_ETH_BI, BYTES_EMPTY),
        'GmxV2IsolationModeUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });

  describe('#createActionsForUnwrapping', () => {

    let withdrawalKey: string;

    beforeEach(async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI_ENCODED,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;
    });

    it('should not work if the input market is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc!,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeUnwrapperImpl: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should not work if the output market is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.dfsGlp!,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `AsyncIsolationModeUnwrapperImpl: Invalid output market <${core.marketIds.dfsGlp!.toString()}>`,
      );
    });

    it('should not work if the trade types and keys do not match in length', async () => {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]'],
        [[UnwrapTradeType.ForWithdrawal, UnwrapTradeType.ForWithdrawal], [withdrawalKey]],
      );
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc!,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei,
          orderData: orderData,
        }),
        'AsyncIsolationModeUnwrapperImpl: Invalid unwrapping order data',
      );
    });

    it('should not work if the input amount is too large', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ZERO_BI,
          primaryAccountOwner: ZERO_ADDRESS,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: ZERO_ADDRESS,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.nativeUsdc!,
          inputMarket: marketId,
          minOutputAmount: ONE_BI,
          inputAmount: amountWei.add(1),
          orderData: encodeWithdrawalKey(UnwrapTradeType.ForWithdrawal, withdrawalKey),
        }),
        'AsyncIsolationModeUnwrapperImpl: Invalid input amount',
      );
    });
  });
});
