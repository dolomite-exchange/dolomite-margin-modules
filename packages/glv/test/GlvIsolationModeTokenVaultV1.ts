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
  getDefaultProtocolConfigForGlv,
  setupCoreProtocol,
  setupGLVBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvRegistry,
  IGlvToken,
  IGmxRoleStore__factory,
  TestGlvIsolationModeTokenVaultV1,
  TestGlvIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createGlvIsolationModeUnwrapperTraderV2,
  createGlvIsolationModeVaultFactory,
  createGlvIsolationModeWrapperTraderV2,
  createGlvLibrary,
  createGlvRegistry,
  createTestGlvIsolationModeTokenVaultV1,
  getInitiateUnwrappingParams,
  getInitiateWrappingParams,
  getKey
} from './glv-ecosystem-utils';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { IGmxMarketToken, TestGmxDataStore, TestGmxDataStore__factory, TestGmxReader, TestGmxReader__factory } from 'packages/gmx-v2/src/types';
import { createGmxV2Library } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';

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
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

const executionFee =
  process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE_FOR_TESTS : GMX_V2_EXECUTION_FEE_FOR_TESTS.mul(10);

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

describe('GlvIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGlvToken;
  let gmMarketToken: IGmxMarketToken;
  let glvRegistry: GlvRegistry;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let factory: GlvIsolationModeVaultFactory;
  let vault: TestGlvIsolationModeTokenVaultV1;
  let vault2: TestGlvIsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let impersonatedFactory: SignerWithAddressWithSafety;
  let impersonatedVault: SignerWithAddressWithSafety;
  let eventEmitter: EventEmitterRegistry;
  let controller: SignerWithAddressWithSafety;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultProtocolConfigForGlv());
    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken;
    gmMarketToken = core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken;
    const glvLibrary = await createGlvLibrary();
    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createTestGlvIsolationModeTokenVaultV1(core);

    glvRegistry = await createGlvRegistry(core, gmMarketToken, GMX_V2_CALLBACK_GAS_LIMIT);

    allowableMarketIds = [core.marketIds.nativeUsdc, core.marketIds.weth];
    factory = await createGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem.glvTokens.wethUsdc,
      userVaultImplementation,
      executionFee,
    );
    impersonatedFactory = await impersonate(factory.address, true);
    unwrapper = await createGlvIsolationModeUnwrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);
    wrapper = await createGlvIsolationModeWrapperTraderV2(core, factory, glvLibrary, gmxV2Library, glvRegistry);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);

    const dataStore = core.gmxV2Ecosystem.gmxDataStore;
    const controllerKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['CONTROLLER']));
    const roleStore = IGmxRoleStore__factory.connect(await dataStore.roleStore(), core.hhUser1);
    const controllers = await roleStore.getRoleMembers(controllerKey, 0, 1);
    controller = await impersonate(controllers[0], true);

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

    await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await glvRegistry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    await factory.createVault(core.hhUser1.address);
    await factory.createVault(core.hhUser2.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    const vaultAddress2 = await factory.getVaultByAccount(core.hhUser2.address);
    vault = setupUserVaultProxy<TestGlvIsolationModeTokenVaultV1>(
      vaultAddress,
      TestGlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    vault2 = setupUserVaultProxy<TestGlvIsolationModeTokenVaultV1>(
      vaultAddress2,
      TestGlvIsolationModeTokenVaultV1__factory,
      core.hhUser2,
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

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

    it('should fail if invalid extra data', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      const extraData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes'], [parseEther('.5'), ONE_BI, '0x01']);
      await expectThrow(
        vault.initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.weth.address,
          TWO_BI,
          extraData,
          { value: executionFee },
        ),
        'GlvLibrary: Invalid extra data',
      );
    });

    it('should fail if amount is too small', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
        'GlvLibrary: minOutputAmount too small',
      );
    });

    it('should fail if user is underwater', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      // Create debt for the position
      let glvPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;

      const wethAmount = amountWei.mul(glvPrice).div(wethPrice).mul(100).div(121);
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

      glvPrice = glvPrice.mul(70).div(100);
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, glvPrice);
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });

    it('should fail if output token is invalid', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.wbtc.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: executionFee,
        }),
        'GlvIsolationModeVaultV1: Invalid output token',
      );
    });

    it('should fail if input amount is 0', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expectThrow(
        vault.initiateUnwrapping(borrowAccountNumber, amountWei, core.tokens.weth.address, ONE_BI, DEFAULT_EXTRA_DATA, {
          value: ONE_ETH_BI.add(1),
        }),
        'GlvIsolationModeVaultV1: Invalid execution fee',
      );
    });

    it('should fail if vault attempts to over withdraw', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
    it('should work normally', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        BigNumber.from('500000'), // $.50
        BalanceCheckFlag.None
      );

      await glvRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await vault.connect(core.hhUser5).initiateUnwrappingForLiquidation(
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc.address,
        parseEther('.0000000000001'),
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
    });

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
      const depositKey = (await eventEmitter.queryFilter(filter, txResult.blockHash))[0].args.key;
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
      const filter = eventEmitter.filters.AsyncDepositCreated(undefined, factory.address);
      const depositKey = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await expectThrow(
        vault2.cancelDeposit(depositKey),
        `GlvLibrary: Invalid vault owner <${vault.address.toLowerCase()}>`,
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      const res = await vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        minAmountOut,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const withdrawalKey = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args.key;

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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      const res = await vault.initiateUnwrappingWithLiquidationTrue(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        TWO_BI,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const withdrawalKey = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args.key;

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
        'GlvLibrary: Withdrawal from liquidation',
      );
    });

    it('should fail if a user attempts to cancel another users withdrawal', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      const res = await vault.initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        TWO_BI,
        DEFAULT_EXTRA_DATA,
        { value: executionFee },
      );
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      const filter = eventEmitter.filters.AsyncWithdrawalCreated(undefined, factory.address);
      const withdrawalKey = (await eventEmitter.queryFilter(filter, res.blockHash))[0].args.key;

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
        `GlvLibrary: Invalid vault owner <${vault.address.toLowerCase()}>`,
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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

  describe('#openMarginPosition', () => {
    const borrowMarketId = 2;

    it('should work normally', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openMarginPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        borrowMarketId,
        amountWei,
        { value: executionFee }
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, borrowAccountNumber, marketId, amountWei);
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });

    it('should fail if execution fee does not match', async () => {
      await expectThrow(
        vault.openMarginPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          borrowMarketId,
          amountWei.div(2),
          { value: executionFee.add(1) }
        ),
        'GmxV2Library: Invalid execution fee',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(0);
    });

    it('should fail if execution fee already paid', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openMarginPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        borrowMarketId,
        amountWei,
        { value: executionFee }
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);

      await expectThrow(vault.openMarginPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          borrowMarketId,
          amountWei,
          { value: executionFee }
        ),
        'GmxV2Library: Execution fee already paid',
      );
      expect(await vault.getExecutionFeeForAccountNumber(borrowAccountNumber)).to.eq(executionFee);
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
        'GlvIsolationModeVaultV1: Missing execution fee',
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });

      // Create debt for the position
      let glvPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;

      const wethAmount = amountWei.mul(glvPrice).div(wethPrice).mul(100).div(121);
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

      glvPrice = glvPrice.mul(70).div(100);
      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, glvPrice);
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);

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
        'GmxV2Library: Cannot send ETH for non-wrapper',
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
      const key = getKey(
        'EXECUTE_GLV_WITHDRAWAL_FEATURE_DISABLED',
        ['address'],
        [core.glvEcosystem.glvHandler.address]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setBool(key, true);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      await setupGLVBalance(core, underlyingToken, core.hhUser1, amountWei, vault);
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
      const key = getKey('CREATE_GLV_WITHDRAWAL_FEATURE_DISABLED', ['address'], [core.glvEcosystem.glvHandler.address]);
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setBool(key, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if execute withdrawals are disabled', async () => {
      const key = getKey(
        'EXECUTE_GLV_WITHDRAWAL_FEATURE_DISABLED',
        ['address'],
        [core.glvEcosystem.glvHandler.address]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setBool(key, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return false if short and long are less than max pnl', async () => {
      const withdrawalsBytes32 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string'],
          ['MAX_PNL_FACTOR_FOR_WITHDRAWALS']
        )
      );
      const longKey = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, true]
      );
      const shortKey = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, false]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(longKey, MAX_UINT_256_BI.div(2));
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(shortKey, MAX_UINT_256_BI.div(2));
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return true if short is greater than max pnl', async () => {
      const withdrawalsBytes32 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['MAX_PNL_FACTOR_FOR_WITHDRAWALS']));
      const key = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, false]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(key, 1);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if long is greater than max pnl', async () => {
      const withdrawalsBytes32 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['MAX_PNL_FACTOR_FOR_WITHDRAWALS']));
      const key = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, true]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(key, MAX_UINT_256_BI.div(2).add(1));
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if both are greater than max pnl', async () => {
      const withdrawalsBytes32 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['MAX_PNL_FACTOR_FOR_WITHDRAWALS']));
      const longKey = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, true]
      );
      const shortKey = getKey(
        'MAX_PNL_FACTOR',
        ['bytes32', 'address', 'bool'],
        [withdrawalsBytes32, gmMarketToken.address, false]
      );
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(longKey, MAX_UINT_256_BI.div(2).add(1));
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setUint(shortKey, MAX_UINT_256_BI.div(2).add(1));
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if max callback gas limit is too large', async () => {
      await glvRegistry.connect(core.governance).ownerSetCallbackGasLimit(MAX_UINT_256_BI);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if glv market is disabled', async () => {
      const key = getKey('IS_GLV_MARKET_DISABLED', ['address'], [underlyingToken.address]);
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setBool(key, true);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if gm market is disabled', async () => {
      const key = getKey('IS_MARKET_DISABLED', ['address'], [gmMarketToken.address]);
      await core.gmxV2Ecosystem.gmxDataStore.connect(controller).setBool(key, true);
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
