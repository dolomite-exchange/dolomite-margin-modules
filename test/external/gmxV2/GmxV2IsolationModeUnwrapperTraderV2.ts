import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import {
  GmxRegistryV2,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2MarketTokenPriceOracle,
  IERC20,
  IGmxMarketToken,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeTokenVaultV1__factory,
} from 'src/types';
import { depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { BYTES_EMPTY, BYTES_ZERO, MAX_UINT_256_BI, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from 'test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2MarketTokenPriceOracle,
  createTestGmxV2IsolationModeTokenVaultV1,
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
import { GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';

enum ReversionType {
  None = 0,
  Assert = 1,
  Require = 2,
}

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const CALLBACK_GAS_LIMIT = BigNumber.from('2000000'); // 2M units
const usdcAmount = BigNumber.from('1000000000'); // $1000
const amountWei = parseEther('10');

describe('GmxV2IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let allowableMarketIds: BigNumberish[];
  let gmxRegistryV2: GmxRegistryV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: TestGmxV2IsolationModeTokenVaultV1;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const library = await createGmxV2Library();
    const userVaultImplementation = await createTestGmxV2IsolationModeTokenVaultV1(core, library);
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      library,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      library,
      gmxRegistryV2,
      CALLBACK_GAS_LIMIT,
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      library,
      gmxRegistryV2,
      CALLBACK_GAS_LIMIT,
    );
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);
    priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxRegistryV2);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestGmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      TestGmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
    await setEtherBalance(core.gmxEcosystemV2!.gmxExecutor.address, parseEther('100'));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await unwrapper.GMX_REGISTRY_V2()).to.eq(gmxRegistryV2.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        unwrapper.initialize(
          factory.address,
          core.dolomiteMargin.address,
          gmxRegistryV2.address,
          core.tokens.weth.address,
          CALLBACK_GAS_LIMIT,
        ),
        'Initializable: contract is already initialized',
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
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = unwrapper.filters.WithdrawalCreated();
      withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
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
        `GmxV2IsolationModeUnwrapperV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
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
        `GmxV2IsolationModeUnwrapperV2: Invalid output token <${core.tokens.wbtc.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect for withdrawal', async () => {
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
            [ONE_BI, ethers.utils.defaultAbiCoder.encode(['bytes32'], [withdrawalKey])],
          ),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid output token',
      );
    });

    it('should fail if input amount is incorrect for withdrawal', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          amountWei.add(1),
          ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [ONE_BI, ethers.utils.defaultAbiCoder.encode(['bytes32'], [withdrawalKey])],
          ),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid input amount',
      );
    });

    it('should fail if output amount is insufficient for withdrawal', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [2, ethers.utils.defaultAbiCoder.encode(['bytes32'], [withdrawalKey])],
          ),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid output amount',
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
        'GmxV2IsolationModeUnwrapperV2: Invalid input amount',
      );
    });
  });

  describe('#afterWithdrawalCancellation', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      // 0x10aeb692
      // 00000000000000000000000000000000000000000000000000000000002dc6c0
      // 00000000000000000000000000000000000000000000000000000000001e8480
      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

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
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        MAX_UINT_256_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 10_000_000 },
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
        parseEther('.01'),
        core.tokens.nativeUsdc!.address,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
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
        parseEther('.01'),
        core.tokens.weth.address,
        core.tokens.nativeUsdc!.address,
      );
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalCancellation(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key',
      );
    });
  });

  describe('#afterWithdrawalExecution', () => {
    let withdrawalKey: string;

    async function setupBalances(outputToken: IERC20) {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        outputToken.address,
        ONE_BI,
        { value: parseEther('0.01') },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = unwrapper.filters.WithdrawalCreated();
      withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(outputToken.address);
      expect(withdrawal.outputAmount).to.eq(ZERO_BI);

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(true);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    }

    it('should work normally with actual oracle params and long token', async () => {
      await setupBalances(core.tokens.weth);
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalExecuted', {
        key: withdrawalKey,
      });

      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
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

    it('should work normally with actual oracle params and short token', async () => {
      await setupBalances(core.tokens.nativeUsdc!);
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalExecuted', {
        key: withdrawalKey,
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
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalFailed', {
        key: withdrawalKey,
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
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalFailed', {
        key: withdrawalKey,
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

    it('should fail if given invalid event data', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const unwrapperImpersonate = await impersonate(unwrapper.address, true);
      await setupNativeUSDCBalance(core, unwrapperImpersonate, 100e6, core.gmxEcosystem!.esGmxDistributor);
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
        'GmxV2IsolationModeUnwrapperV2: Unexpected outputToken',
      );

      withdrawalInfo.eventData.addressItems.items[0].key = 'outputToken';
      withdrawalInfo.eventData.addressItems.items[1].key = 'badSecondaryOutputToken';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected secondaryOutputToken',
      );

      withdrawalInfo.eventData.addressItems.items[1].key = 'secondaryOutputToken';
      withdrawalInfo.eventData.uintItems.items[0].key = 'badOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected outputAmount',
      );

      withdrawalInfo.eventData.uintItems.items[0].key = 'outputAmount';
      withdrawalInfo.eventData.uintItems.items[1].key = 'badSecondaryOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected secondaryOutputAmount',
      );
    });

    it('should fail if more than one output token received', async () => {
      await setupBalances(core.tokens.weth);
      const withdrawalExecutor = await impersonate(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
      const unwrapperImpersonate = await impersonate(unwrapper.address, true);
      await setupNativeUSDCBalance(core, unwrapperImpersonate, 100e6, core.gmxEcosystem!.esGmxDistributor);
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
        'GmxV2IsolationModeUnwrapperV2: Can only receive one token',
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
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
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
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key',
      );
    });

    it('should fail when withdrawal amount does not match', async () => {
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
        ONE_BI,
        ONE_BI,
      );
      const vaultImpersonator = await impersonate(vault.address, true);
      await unwrapper.connect(vaultImpersonator)
        .vaultSetWithdrawalInfo(DUMMY_WITHDRAWAL_KEY, defaultAccountNumber, '123123', core.tokens.weth.address);
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData,
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid market token amount',
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
          defaultAbiCoder.encode(['uint256'], [amountWei]),
        ),
        `GmxV2IsolationModeUnwrapperV2: Account owner is not a vault <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer amount is zero or gt withdrawal amount', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await unwrapper.connect(vaultCaller).vaultSetWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ZERO_BI, DUMMY_WITHDRAWAL_KEY]),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid transfer amount',
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'uint256'], [amountWei.add(1), DUMMY_WITHDRAWAL_KEY]),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid transfer amount',
      );
    });

    it('should fail if virtual underlying balance is insufficient', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      const vaultCaller = await impersonate(vault.address, true);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await unwrapper.connect(vaultCaller).vaultSetWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
      );

      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'uint256'], [amountWei, DUMMY_WITHDRAWAL_KEY]),
        ),
        `GmxV2IsolationModeUnwrapperV2: Insufficient balance <0, ${amountWei.toString()}>`,
      );
    });
  });

  describe('#vaultSetWithdrawalInfo', () => {
    it('should fail if not called by vault', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).vaultSetWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY,
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid vault',
      );
    });

    it('should fail if the vault is already frozen for this account number', async () => {
      const vaultSigner = await impersonate(vault.address, true);
      await unwrapper.connect(vaultSigner).vaultSetWithdrawalInfo(
        DUMMY_WITHDRAWAL_KEY,
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
      );
      await expectThrow(
        unwrapper.connect(vaultSigner).vaultSetWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY.replace('f', 'e'),
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
        ),
        `GmxV2Library: Account is frozen <${vault.address.toLowerCase()}, ${defaultAccountNumber}>`,
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
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = unwrapper.filters.WithdrawalCreated();
      withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
    });

    it('should not work if the input market is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          ZERO_BI,
          ZERO_BI,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.nativeUsdc!,
          core.marketIds.weth,
          ONE_BI,
          amountWei,
          BYTES_EMPTY,
        ),
        `GmxV2IsolationModeUnwrapperV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should not work if the output market is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          ZERO_BI,
          ZERO_BI,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.dfsGlp!,
          marketId,
          ONE_BI,
          amountWei,
          BYTES_EMPTY,
        ),
        `GmxV2IsolationModeUnwrapperV2: Invalid output market <${core.marketIds.dfsGlp!.toString()}>`,
      );
    });

    it('should not work if the key passed is invalid', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          ZERO_BI,
          ZERO_BI,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.nativeUsdc!,
          marketId,
          ONE_BI,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(['bytes32'], [BYTES_ZERO]),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal',
      );
    });

    it('should not work if the input amount is too large', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          ZERO_BI,
          ZERO_BI,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.nativeUsdc!,
          marketId,
          ONE_BI,
          amountWei.add(1),
          ethers.utils.defaultAbiCoder.encode(['bytes32'], [withdrawalKey]),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid input amount',
      );
    });
  });
});
