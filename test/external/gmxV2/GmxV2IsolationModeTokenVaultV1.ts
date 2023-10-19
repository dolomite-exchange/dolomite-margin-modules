import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  CustomTestToken,
  GmxV2Registry,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
  TestGmxReader,
  TestGmxReader__factory,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeTokenVaultV1__factory,
} from 'src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from 'src/utils/dolomite-utils';
import { MAX_UINT_256_BI, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from 'test/utils/assertions';
import {
  createGmxV2Registry,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  getInitiateUnwrappingParams,
  getInitiateWrappingParams,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'test/utils/setup';
import { getSimpleZapParams } from 'test/utils/zap-utils';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';
import { createSafeDelegateLibrary } from '../../utils/ecosystem-token-utils/general';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = parseEther('1');
const otherAmountWei = parseEther('0.33');
const minAmountOut = parseEther('1800');
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const INVALID_POOL_FACTOR = BigNumber.from('900000000000000000000000000000'); // 9e29
const VALID_POOL_FACTOR = BigNumber.from('700000000000000000000000000000'); // 7e29

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxV2Registry: GmxV2Registry;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: TestGmxV2IsolationModeTokenVaultV1;
  let vault2: TestGmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let impersonatedFactory: SignerWithAddress;
  let impersonatedVault: SignerWithAddress;
  let testReader: TestGmxReader;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const safeDelegateCallLibrary = await createSafeDelegateLibrary();
    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createContractWithLibrary<TestGmxV2IsolationModeTokenVaultV1>(
      'TestGmxV2IsolationModeTokenVaultV1',
      { GmxV2Library: gmxV2Library.address, SafeDelegateCallLib: safeDelegateCallLibrary.address },
      [core.tokens.weth.address],
    );
    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);

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
    impersonatedFactory = await impersonate(factory.address, true);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    await gmxV2Registry.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxV2Registry.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds(
      [...allowableMarketIds, marketId, otherMarketId1, otherMarketId2],
    );
    await factory.connect(core.governance).ownerSetAllowableDebtMarketIds(
      [...allowableMarketIds, otherMarketId1, otherMarketId2],
    );

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

    testReader = await createContractWithAbi(
      TestGmxReader__factory.abi,
      TestGmxReader__factory.bytecode,
      [],
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, amountWei);

    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.hhUser5.address);
    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);

    impersonatedVault = await impersonate(vault.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      const result = await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      );
      await expect(result).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(core.tokens.weth.address);
      expect(withdrawal.outputAmount).to.eq(ONE_BI);
    });

    it('should fail if output token is invalid', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.wbtc.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'GmxV2IsolationModeVaultV1: Invalid output token',
      );
    });

    it('should fail if input amount is 0', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          ZERO_BI,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'GmxV2IsolationModeVaultV1: Invalid input amount',
      );
    });

    it('should fail if vault attempts to over withdraw', async () => {
      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        `GmxV2Library: Withdrawal too large <${vault.address.toLowerCase()}, ${borrowAccountNumber}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      expect(await vault.isVaultFrozen()).to.be.false;
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        toPositiveWeiStruct(ONE_BI),
      );
      expect(await vault.isVaultFrozen()).to.be.true;

      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );

      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        toNegativeWeiStruct(ONE_BI),
      );
      expect(await vault.isVaultFrozen()).to.be.false;
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        toPositiveWeiStruct(ONE_BI),
      );
      expect(await vault.isVaultFrozen()).to.be.true;

      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await vault.populateTransaction.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
      );
      await expectThrow(
        vault.callFunctionAndTriggerReentrancy(
          transaction.data!,
          { value: parseEther('.01') },
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#initiateUnwrappingForLiquidation', () => {
    it('should fail if sender is not a valid liquidator', async () => {
      await expectThrow(
        vault.initiateUnwrappingForLiquidation(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        `GmxV2IsolationModeVaultV1: Only liquidator can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await vault.populateTransaction.initiateUnwrappingForLiquidation(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
      );
      await expectThrow(
        vault.callFunctionAndTriggerReentrancy(
          transaction.data!,
          { value: parseEther('.01') },
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#cancelDeposit', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        minAmountOut,
        wrapper,
        GMX_V2_EXECUTION_FEE,
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') },
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit: GMX_V2_CALLBACK_GAS_LIMIT.mul(2) });
      await expectEvent(wrapper, result, 'DepositCancelled', {
        key: depositKey,
      });

      expect(await vault.isVaultFrozen()).to.eq(false);
    });

    it('should fail if a user attempts to cancel a different users deposit', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        minAmountOut,
        wrapper,
        GMX_V2_EXECUTION_FEE,
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') },
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await expectThrow(
        vault2.cancelDeposit(depositKey),
        `GmxV2IsolationModeVaultV1: Invalid vault owner <${vault.address.toLowerCase()}>`,
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).cancelDeposit(DUMMY_DEPOSIT_KEY),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#cancelWithdrawal', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

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

    it('should fail if a user attempts to cancel another users withdrawal', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await expectThrow(
        vault2.cancelWithdrawal(withdrawalKey),
        `GmxV2IsolationModeVaultV1: Invalid vault owner <${vault.address.toLowerCase()}>`,
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).cancelWithdrawal(DUMMY_WITHDRAWAL_KEY),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail if transfer is skipped and vault is not frozen', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI),
        'GmxV2IsolationModeVaultV1: Vault should be frozen',
      );
    });

    it('should fail if virtual balance does not equal real balance', async () => {
      await setupGMBalance(core, await impersonate(wrapper.address, true), ONE_ETH_BI, vault);
      await setupGMBalance(core, await impersonate(vault.address, true), ONE_BI, wrapper);

      await expectThrow(
        vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI),
        'GmxV2IsolationModeVaultV1: Virtual vs real balance mismatch',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.executeDepositIntoVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail if transfer is skipped and vault is not frozen', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, ZERO_BI),
        'GmxV2IsolationModeVaultV1: Vault should be frozen',
      );
    });

    it('should fail if virtual balance does not equal real balance', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        toPositiveWeiStruct(ONE_BI),
      );
      await vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI);
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Deposit,
        toNegativeWeiStruct(ONE_BI),
      );
      await setupGMBalance(core, await impersonate(vault.address, true), parseEther('.5'), vault);

      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, parseEther('.5')),
        'GmxV2IsolationModeVaultV1: Virtual vs real balance mismatch',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.executeWithdrawalFromVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });

    it('should fail if execution fee does not match', async () => {
      await expectThrow(
        vault.openBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          amountWei.div(2),
          { value: GMX_V2_EXECUTION_FEE.add(1) },
        ),
        'GmxV2Library: Invalid execution fee',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(0);
    });

    it('should fail if execution fee already paid', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await expectThrow(
        vault.openBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          amountWei.div(2),
          { value: GMX_V2_EXECUTION_FEE },
        ),
        'GmxV2Library: Execution fee already paid',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally once position is open', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
        { value: GMX_V2_EXECUTION_FEE },
      );
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
    });

    it('should fail if position is not yet open', async () => {
      await expectThrow(
        vault.transferIntoPositionWithUnderlyingToken(
          defaultAccountNumber,
          borrowAccountNumber,
          amountWei,
        ),
        'GmxV2IsolationModeVaultV1: Missing execution fee',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally for wrapping', async () => {
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
        minAmountOut,
        wrapper,
        parseEther('.01'),
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should work normally when not frozen', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });

    it('should work if called by unwrapper', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await vault.connect(unwrapperImpersonator).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });

    it('should fail if no ETH is sent with transaction for wrapping', async () => {
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
        minAmountOut,
        wrapper,
        parseEther('.01'),
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
        ),
        'GmxV2Library: Invalid execution fee',
      );
    });

    it('should fail if ETH is sent for non-wrapper', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
          { value: ONE_BI },
        ),
        'GmxV2IsolationModeVaultV1: Cannot send ETH for non-wrapper',
      );
    });

    it('should fail when caller is not unwrapper for unwrapping is frozen', async () => {
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        toPositiveWeiStruct(ONE_BI),
      );

      const unwrappingParams = await getInitiateUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.usdc,
        1000e6,
        unwrapper,
        parseEther('.01'),
      );
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          unwrappingParams.marketPath,
          unwrappingParams.amountIn,
          unwrappingParams.minAmountOut,
          unwrappingParams.traderParams,
          unwrappingParams.makerAccounts,
          unwrappingParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when redemptions are paused', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(INVALID_POOL_FACTOR, VALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        minAmountOut,
        wrapper,
        parseEther('.01'),
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
          { value: amountWei },
        ),
        `IsolationModeVaultV1Pausable: Cannot zap to market when paused <${marketId.toString()}>`,
      );
    });

    it('should fail if not vault owner or unwrapper', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        minAmountOut,
        wrapper,
        parseEther('.01'),
      );
      await expectThrow(
        vault.connect(core.hhUser2).swapExactInputForOutput(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: amountWei },
        ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if vault is frozen and called by owner', async () => {
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        toPositiveWeiStruct(ONE_BI),
      );
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should not fail if vault is frozen and called by unwrapper', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await factory.connect(impersonatedVault).updateVaultAccountPendingAmountForFrozenStatus(
        vault.address,
        defaultAccountNumber,
        FreezeType.Withdrawal,
        toPositiveWeiStruct(ONE_BI),
      );
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await vault.connect(unwrapperImpersonator).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      const result = await vault.transferFromPositionWithUnderlyingToken(
        borrowAccountNumber,
        defaultAccountNumber,
        amountWei,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [GMX_V2_EXECUTION_FEE]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferFromPositionWithUnderlyingToken(
        borrowAccountNumber,
        defaultAccountNumber,
        amountWei.div(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.div(2),
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      const result = await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [GMX_V2_EXECUTION_FEE]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      const result = await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [GMX_V2_EXECUTION_FEE]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );

      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      const result = await vault.closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [otherMarketId1],
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [GMX_V2_EXECUTION_FEE]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: GMX_V2_EXECUTION_FEE },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );

      await vault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(GMX_V2_EXECUTION_FEE);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should return false with real gmx reader', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return false if short and long are outside pnl range', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(VALID_POOL_FACTOR, VALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return true if max callback gas limit is too large', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetCallbackGasLimit(MAX_UINT_256_BI);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if short is within pnl range', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(INVALID_POOL_FACTOR, VALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if long is within pnl range', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(VALID_POOL_FACTOR, INVALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return false if both are within pnl range', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(INVALID_POOL_FACTOR, INVALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });

  describe('#setIsDepositSourceWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setIsDepositSourceWrapper(true);
      await expectEvent(vault, result, 'IsDepositSourceWrapperSet', {
        isDepositSourceWrapper: true,
      });
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.setIsDepositSourceWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectEvent(vault, result, 'ShouldSkipTransferSet', {
        shouldSkipTransfer: true,
      });
      expect(await vault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

function toNegativeWeiStruct(value: BigNumberish) {
  return {
    sign: false,
    value: BigNumber.from(value),
  };
}

function toPositiveWeiStruct(value: BigNumberish) {
  return {
    sign: true,
    value: BigNumber.from(value),
  };
}
