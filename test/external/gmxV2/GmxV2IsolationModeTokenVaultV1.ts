import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  CustomTestToken,
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
} from 'src/types';
import { createTestToken, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  getInitiateWrappingParams,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'test/utils/setup';
import { getSimpleZapParams } from 'test/utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = parseEther('1');
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core);
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000' // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000' // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds([...allowableMarketIds, marketId, otherMarketId1, otherMarketId2]);
    await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([...allowableMarketIds, otherMarketId1, otherMarketId2]);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await wrapper.connect(core.governance).setIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await wrapper.connect(core.governance).setIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
    });
  });

  describe('#initiateWrapping', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail if no funds are send with transaction', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await expect(vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig
      )).to.be.reverted;
    });

    it('should fail when vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await expectThrow(
        vault.connect(core.hhUser1).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: amountWei }
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });

    it('should fail if _tradeAccountNumber does not match tradeData account number', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await expectThrow(
        vault.connect(core.hhUser1).initiateWrapping(
          ZERO_BI,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: parseEther('.01') }
        ),
        'GmxV2IsolationModeVaultV1: Invalid tradeData',
      );
    });

    it('should fail if TraderType is not IsolationModeWrapper', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      initiateWrappingParams.traderParams[0].traderType = 0;
      await expectThrow(
        vault.connect(core.hhUser1).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: parseEther('.01') }
        ),
        'GmxV2IsolationModeVaultV1: Invalid traderType',
      );
    });

    it('should fail if not vault owner', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.usdc,
        1000e6,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await expectThrow(
        vault.connect(core.hhUser2).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: amountWei }
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  xdescribe('#initiateUnwrapping', () => {});

  describe('#cancelDeposit', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.weth,
          amountWei,
          BalanceCheckFlag.Both
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        1,
        wrapper,
        parseEther('.01'),
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelDeposit(depositKey);
      expect(await vault.isVaultFrozen()).to.eq(false);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).cancelDeposit(DUMMY_DEPOSIT_KEY),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#shouldExecuteDepositIntoVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#shouldExecuteWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both
      );
      await vault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.closeBorrowPositionWithOtherTokens(defaultAccountNumber, borrowAccountNumber, []),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        amountWei.div(4),
        BalanceCheckFlag.To
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.transferFromPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          0,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        amountWei.div(2),
        BalanceCheckFlag.To
      );
      await vault.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.Both
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          BalanceCheckFlag.Both
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should work normally', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await vault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await vault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both
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
        zapParams.userConfig
      );
    });

    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen'
      );
    });
  });

  describe('#setIsVaultFrozen', () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      expect(await vault.isVaultFrozen()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setIsVaultFrozen(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setIsDepositSourceWrapper', () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setIsDepositSourceWrapper(true);
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setIsDepositSourceWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

async function mineBlocks(blockNumber: number) {
  let i = blockNumber;
  while (i > 0) {
    await ethers.provider.send('evm_mine', []);
    i--;
  }
}
