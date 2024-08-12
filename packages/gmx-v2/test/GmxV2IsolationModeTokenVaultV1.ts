import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import {
  CustomTestToken,
  EventEmitterRegistry,
  EventEmitterRegistry__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createTestToken,
  depositIntoDolomiteMargin,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  TWO_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getSimpleZapParams } from '@dolomite-exchange/modules-base/test/utils/zap-utils';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import hardhat, { ethers } from 'hardhat';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE_FOR_TESTS } from '../src/gmx-v2-constructors';
import {
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Registry,
  IGmxMarketToken,
  TestGmxDataStore,
  TestGmxDataStore__factory,
  TestGmxReader,
  TestGmxReader__factory,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2Registry,
  createTestGmxV2IsolationModeTokenVaultV1,
  getInitiateUnwrappingParams,
  getInitiateWrappingParams,
} from './gmx-v2-ecosystem-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = parseEther('1');
const otherAmountWei = parseEther('0.33');
const usdcAmount = BigNumber.from('1000000000'); // $1000
const minAmountOut = parseEther('800');
// noinspection SpellCheckingInspection
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
// noinspection SpellCheckingInspection
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const CREATE_WITHDRAWALS_DISABLED_KEY = '0xe22e21c60f32cfb79020e8dbf3211f7a678325f5d7195c979268c4db4a4a6fa1';
const EXECUTE_WITHDRAWALS_DISABLED_KEY = '0xa5d5ec2aef29f70d602db4f2b395018c1a19c7f69e551e9943277b57770f0dd0';
const IS_MARKET_DISABLED_KEY = '0x5c27e8a9fa01145fb01eb80b81db2eab7e57bc33d109d6a64315239a65ce4d36';
const INVALID_POOL_FACTOR = BigNumber.from('1000000000000000000000000000000'); // 10e29
const VALID_POOL_FACTOR = BigNumber.from('700000000000000000000000000000'); // 7e29
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

const executionFee =
  process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE_FOR_TESTS : GMX_V2_EXECUTION_FEE_FOR_TESTS.mul(10);

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGmxMarketToken;
  let gmxV2Registry: GmxV2Registry;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: TestGmxV2IsolationModeTokenVaultV1;
  let vault2: TestGmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let impersonatedFactory: SignerWithAddressWithSafety;
  let impersonatedVault: SignerWithAddressWithSafety;
  let testReader: TestGmxReader;
  let testDataStore: TestGmxDataStore;
  let eventEmitter: EventEmitterRegistry;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 235_717_900,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystemV2.gmxEthUsdMarketToken.connect(core.hhUser1);
    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createTestGmxV2IsolationModeTokenVaultV1(core);

    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);
    await gmxV2Registry
      .connect(core.governance)
      .ownerSetGmxMarketToIndexToken(underlyingToken.address, core.gmxEcosystemV2.gmTokens.ethUsd.indexToken.address);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxV2Library,
      gmxV2Registry,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2.gmTokens.ethUsd,
      userVaultImplementation,
      executionFee,
    );
    impersonatedFactory = await impersonate(factory.address, true);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxV2Library, gmxV2Registry);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxV2Library, gmxV2Registry);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1000000000000000000');
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

    await factory
      .connect(core.governance)
      .ownerSetAllowableCollateralMarketIds([...allowableMarketIds, marketId, otherMarketId1, otherMarketId2]);
    await factory
      .connect(core.governance)
      .ownerSetAllowableDebtMarketIds([...allowableMarketIds, otherMarketId1, otherMarketId2]);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

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

    testDataStore = await createContractWithAbi(TestGmxDataStore__factory.abi, TestGmxDataStore__factory.bytecode, []);

    testReader = await createContractWithAbi(TestGmxReader__factory.abi, TestGmxReader__factory.bytecode, []);

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

    eventEmitter = EventEmitterRegistry__factory.connect(await core.dolomiteRegistry.eventEmitter(), core.hhUser1);
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

  describe('#receive', () => {
    it('should work normally', async () => {
      const balanceBefore = await hardhat.ethers.provider.getBalance(vault.address);
      await core.hhUser1.sendTransaction({
        value: ONE_ETH_BI,
        to: vault.address,
      });
      expect(await hardhat.ethers.provider.getBalance(vault.address)).to.eq(ONE_ETH_BI.add(balanceBefore));
    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      const result = await vault.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI.mul(2),
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expect(result).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const eventArgs = (await eventEmitter.queryFilter(filter, result.blockHash))[0].args;
      expect(eventArgs.token).to.eq(factory.address);

      const withdrawalKey = eventArgs.key;
      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      expect(withdrawal.vault).to.eq(vault.address);
      expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(withdrawal.inputAmount).to.eq(amountWei);
      expect(withdrawal.outputToken).to.eq(core.tokens.weth.address);
      expect(withdrawal.outputAmount).to.eq(ONE_BI.add(ONE_BI));
      expect(withdrawal.isRetryable).to.eq(false);

      expect(eventArgs.withdrawal.key).to.eq(withdrawalKey);
      expect(eventArgs.withdrawal.vault).to.eq(vault.address);
      expect(eventArgs.withdrawal.accountNumber).to.eq(borrowAccountNumber);
      expect(eventArgs.withdrawal.inputAmount).to.eq(amountWei);
      expect(eventArgs.withdrawal.outputToken).to.eq(core.tokens.weth.address);
      expect(eventArgs.withdrawal.outputAmount).to.eq(ONE_BI.add(ONE_BI));
      expect(eventArgs.withdrawal.isRetryable).to.eq(false);
    });

    it('should fail if amount is too small', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          ZERO_BI,
          DEFAULT_EXTRA_DATA,
          { value: executionFee },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid minOutputAmount',
      );

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'GmxV2Library: minOutputAmount too small',
      );
    });

    it('should fail if user is underwater', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      // Create debt for the position
      let gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;

      const wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(121);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      // await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        amountWei.add(wethAmount),
      );
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount),
      );

      gmPrice = gmPrice.mul(70).div(100);
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, gmPrice);
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail if output token is invalid', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.wbtc.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'GmxV2IsolationModeVaultV1: Invalid output token',
      );
    });

    it('should fail if input amount is 0', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, ZERO_BI, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'IsolationVaultV1AsyncFreezable: Invalid withdrawal amount',
      );
    });

    it('should fail if execution fee is too big', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: ONE_ETH_BI.add(1),
        }),
        'GmxV2IsolationModeVaultV1: Invalid execution fee',
      );
    });

    it('should fail if vault attempts to over withdraw', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        `IsolationVaultV1AsyncFreezable: Withdrawal too large <${vault.address.toLowerCase()}, ${borrowAccountNumber}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      expect(await vault.isVaultFrozen()).to.be.false;
      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          toPositiveWeiStruct(ONE_BI),
          core.tokens.weth.address,
        );
      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await vault.getOutputTokenByVaultAccount(defaultAccountNumber)).to.eq(core.tokens.weth.address);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );

      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Deposit,
          toNegativeWeiStruct(ONE_BI),
          core.tokens.weth.address,
        );
      expect(await vault.isVaultFrozen()).to.be.false;
      expect(await vault.getOutputTokenByVaultAccount(defaultAccountNumber)).to.eq(ZERO_ADDRESS);
      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Withdrawal,
          toPositiveWeiStruct(ONE_BI),
          core.tokens.weth.address,
        );
      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await vault.getOutputTokenByVaultAccount(defaultAccountNumber)).to.eq(core.tokens.weth.address);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if not owner', async () => {
      await expectThrow(
        vault
          .connect(core.hhUser2)
          .initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
            value: executionFee,
          }),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await vault.populateTransaction.initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        DEFAULT_EXTRA_DATA,
      );
      await expectThrow(
        vault.callFunctionAndTriggerReentrancy(transaction.data!, { value: executionFee }),
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
          DEFAULT_EXTRA_DATA,
          { value: executionFee },
        ),
        `IsolationVaultV1AsyncFreezable: Only liquidator can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await vault.populateTransaction.initiateUnwrappingForLiquidation(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        DEFAULT_EXTRA_DATA,
      );
      await expectThrow(
        vault.callFunctionAndTriggerReentrancy(transaction.data!, { value: executionFee }),
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
      );
      const txResult = await vault.swapExactInputForOutput(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: executionFee },
      );
      const filter = eventEmitter.filters.AsyncDepositCreated(undefined, factory.address);
      const results = await eventEmitter.queryFilter(filter);
      const depositKey = (await eventEmitter.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      const result = await vault.cancelDeposit(depositKey, { gasLimit: GMX_V2_CALLBACK_GAS_LIMIT.mul(2) });
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {
        key: depositKey,
        token: factory.address,
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
      const filter = eventEmitter.filters.AsyncDepositCreated(undefined, factory.address);
      const depositKey = (await eventEmitter.queryFilter(filter))[0].args.key;
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
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() =>
        vault.initiateUnwrapping(
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
          minAmountOut,
          DEFAULT_EXTRA_DATA,
          { value: executionFee },
        ),
      ).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
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

    it('should fail if a user attempts to cancel withdrawal initiated via liquidation', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() =>
        vault.initiateUnwrappingWithLiquidationTrue(
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
          TWO_BI,
          DEFAULT_EXTRA_DATA,
          { value: executionFee },
        ),
      ).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await expectThrow(
        vault.cancelWithdrawal(withdrawalKey),
        'GmxV2IsolationModeVaultV1: Withdrawal from liquidation',
      );
    });

    it('should fail if a user attempts to cancel another users withdrawal', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() =>
        vault.initiateUnwrapping(
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
          TWO_BI,
          DEFAULT_EXTRA_DATA,
          { value: executionFee },
        ),
      ).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const withdrawalKey = (await eventEmitter.queryFilter(filter))[0].args.key;

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
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail if transfer is skipped and vault is not frozen', async () => {
      await vault.connect(impersonatedFactory).setShouldVaultSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI),
        'IsolationVaultV1AsyncFreezable: Vault should be frozen',
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
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await vault.connect(impersonatedFactory).setShouldVaultSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, ZERO_BI),
        'IsolationVaultV1AsyncFreezable: Vault should be frozen',
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
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), {
        value: executionFee,
      });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei.div(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });

    it('should fail if execution fee does not match', async () => {
      await expectThrow(
        vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), {
          value: executionFee.add(1),
        }),
        'GmxV2Library: Invalid execution fee',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(0);
    });

    it('should fail if execution fee already paid', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), {
        value: executionFee,
      });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await expectThrow(
        vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), { value: executionFee }),
        'GmxV2Library: Execution fee already paid',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally once position is open', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), {
        value: executionFee,
      });
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei.div(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
    });

    it('should fail if position is not yet open', async () => {
      await expectThrow(
        vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
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
      await vault
        .connect(unwrapperImpersonator)
        .swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        );
    });

    it('should fail if user is underwater and attempting to initiate wrapping', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      // Create debt for the position
      let gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;

      const wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(121);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        amountWei.add(wethAmount),
      );
      await expectProtocolBalance(
        core,
        vault.address,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount),
      );

      gmPrice = gmPrice.mul(70).div(100);
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, gmPrice);
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
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
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
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

    it('should fail if ETH sent is greater than max execution fee', async () => {
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
          { value: ONE_ETH_BI.mul(2) },
        ),
        'GmxV2IsolationModeVaultV1: Invalid execution fee',
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
      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Withdrawal,
          toPositiveWeiStruct(ONE_BI),
          core.tokens.weth.address,
        );

      const unwrappingParams = await getInitiateUnwrappingParams(
        borrowAccountNumber,
        marketId,
        amountWei,
        core.marketIds.usdc,
        1000e6,
        unwrapper,
        executionFee,
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
        usdcAmount.mul(10),
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
          { value: amountWei },
        ),
        `IsolationModeVaultV1Pausable: Cannot zap to market when paused <${marketId.toString()}>`,
      );
    });

    it('should fail when minOutputAmount is much bigger than inputAmount', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        minAmountOut.mul(100000),
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
          { value: amountWei },
        ),
        'IsolationModeVaultV1ActionsImpl: minOutputAmount too large',
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
      );
      await expectThrow(
        vault
          .connect(core.hhUser2)
          .swapExactInputForOutput(
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
      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Withdrawal,
          toPositiveWeiStruct(ONE_BI),
          core.tokens.weth.address,
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
      await factory
        .connect(impersonatedVault)
        .setVaultAccountPendingAmountForFrozenStatus(
          vault.address,
          defaultAccountNumber,
          FreezeType.Withdrawal,
          toPositiveWeiStruct(ONE_BI),
          core.tokens.weth.address,
        );
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await vault
        .connect(unwrapperImpersonator)
        .swapExactInputForOutput(
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
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      const result = await vault.transferFromPositionWithUnderlyingToken(
        borrowAccountNumber,
        defaultAccountNumber,
        amountWei,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [executionFee]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei.div(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei.div(2), {
        value: executionFee,
      });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.div(2));
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      const result = await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [executionFee]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      const result = await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [executionFee]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should refund execution fee when position is closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );

      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      const result = await vault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [
        otherMarketId1,
      ]);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(ZERO_BI);
      expect(result).to.changeEtherBalances([core.hhUser1], [executionFee]);
    });

    it('should not refund execution fee when position is not closed', async () => {
      await setupGMBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );

      await vault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should return false with real gmx reader', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return true if create withdrawals are disabled', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxDataStore(testDataStore.address);
      const keyValue = await testDataStore.getKey(
        CREATE_WITHDRAWALS_DISABLED_KEY,
        core.gmxEcosystemV2.gmxWithdrawalHandler.address,
      );
      await testDataStore.setBool(keyValue, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if execute withdrawals are disabled', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxDataStore(testDataStore.address);
      const keyValue = await testDataStore.getKey(
        EXECUTE_WITHDRAWALS_DISABLED_KEY,
        core.gmxEcosystemV2.gmxWithdrawalHandler.address,
      );
      await testDataStore.setBool(keyValue, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
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

    it('should return true if market is disabled', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetGmxDataStore(testDataStore.address);
      const keyValue = await testDataStore.getKey(IS_MARKET_DISABLED_KEY, await factory.UNDERLYING_TOKEN());
      await testDataStore.setBool(keyValue, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });

  describe('#setIsVaultDepositSourceWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setIsVaultDepositSourceWrapper(true);
      await expectEvent(vault, result, 'IsDepositSourceWrapperSet', {
        isDepositSourceWrapper: true,
      });
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.setIsVaultDepositSourceWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldVaultSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setShouldVaultSkipTransfer(true);
      await expectEvent(vault, result, 'ShouldSkipTransferSet', {
        shouldSkipTransfer: true,
      });
      expect(await vault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.setShouldVaultSkipTransfer(true),
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
