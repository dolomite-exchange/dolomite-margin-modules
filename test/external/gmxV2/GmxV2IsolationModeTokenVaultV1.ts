import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  CustomTestToken,
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1Library,
  GmxV2IsolationModeTokenVaultV1Library__factory,
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
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
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
const minAmountOut = parseEther('1800');
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const CALLBACK_GAS_LIMIT = BigNumber.from('1500000');
const INVALID_POOL_FACTOR = BigNumber.from('900000000000000000000000000000'); // 9e29
const VALID_POOL_FACTOR = BigNumber.from('700000000000000000000000000000'); // 7e29

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: TestGmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let impersonatedFactory: SignerWithAddress;
  let testReader: TestGmxReader;

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
    const library = await createContractWithAbi<GmxV2IsolationModeTokenVaultV1Library>(
      GmxV2IsolationModeTokenVaultV1Library__factory.abi,
      GmxV2IsolationModeTokenVaultV1Library__factory.bytecode,
      [],
    );
    const userVaultImplementation = await createContractWithLibrary<TestGmxV2IsolationModeTokenVaultV1>(
      'TestGmxV2IsolationModeTokenVaultV1',
      { GmxV2IsolationModeTokenVaultV1Library: library.address },
      [core.tokens.weth.address],
    );
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    impersonatedFactory = await impersonate(factory.address, true);
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
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestGmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      TestGmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    testReader = await createContractWithAbi(
      TestGmxReader__factory.abi,
      TestGmxReader__factory.bytecode,
      [],
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await wrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, amountWei);
    await wrapper.connect(core.governance).ownerSetCallbackGasLimit(CALLBACK_GAS_LIMIT);
    await unwrapper.connect(core.governance).ownerSetCallbackGasLimit(CALLBACK_GAS_LIMIT);

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
        BalanceCheckFlag.Both,
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        minAmountOut,
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
        { value: parseEther('.01') },
      );

      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, minAmountOut);
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
        BalanceCheckFlag.Both,
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        marketId,
        minAmountOut,
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
        initiateWrappingParams.userConfig,
      )).to.be.reverted;
    });

    it('should fail when vault is frozen', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);

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
        vault.connect(core.hhUser1).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: amountWei },
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if _tradeAccountNumber does not match tradeData account number', async () => {
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
        vault.connect(core.hhUser1).initiateWrapping(
          ZERO_BI,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: parseEther('.01') },
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
        minAmountOut,
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
          { value: parseEther('.01') },
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
        minAmountOut,
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
          { value: amountWei },
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentrant', async () => {
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
        vault.connect(core.hhUser1).callInitiateWrappingAndTriggerReentrancy(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: amountWei },
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should fail if output token is invalid', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.wbtc.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'GmxV2IsolationModeVaultV1: Invalid output token',
      );
    });

    it('should fail if vault is frozen', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.wbtc.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if not owner', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.connect(core.hhUser2).initiateUnwrapping(
          borrowAccountNumber,
          amountWei,
          core.tokens.wbtc.address,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.connect(core.hhUser1).callInitiateUnwrappingAndTriggerReentrancy(
          borrowAccountNumber,
          amountWei,
          core.tokens.wbtc.address,
          ONE_BI,
          ONE_BI,
          { value: parseEther('.01') },
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#cancelDeposit', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
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
        { value: parseEther('.01') },
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await vault.connect(core.hhUser1).cancelDeposit(depositKey);
      expect(await vault.isVaultFrozen()).to.eq(false);
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
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

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
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      // Mine blocks so we can cancel deposit
      await mine(1200);
      await vault.connect(core.hhUser1).cancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
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
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
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
      const impersonatedWrapper = await impersonate(wrapper.address, true);
      await setupGMBalance(core, wrapper.address, ONE_ETH_BI, vault);
      await setupGMBalance(core, vault.address, ONE_BI, wrapper);
      await underlyingToken.connect(impersonatedWrapper).approve(vault.address, ONE_ETH_BI);

      await expectThrow(
        vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI),
        'GmxV2IsolationModeVaultV1: Virtual vs real balance mismatch',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
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

    it('should fail if transfer is skipped and vault is not frozen', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, ZERO_BI),
        'GmxV2IsolationModeVaultV1: Vault should be frozen',
      );
    });

    it('should fail if virtual balance does not equal real balance', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await vault.connect(impersonatedFactory).executeDepositIntoVault(wrapper.address, ONE_ETH_BI);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(false);
      await setupGMBalance(core, vault.address, parseEther('.5'), vault);

      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, parseEther('.5')),
        'GmxV2IsolationModeVaultV1: Virtual vs real balance mismatch',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
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

    it('should not fail if called by unwrapper', async () => {
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

    it('should fail if not vault owner or unwrapper', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        vault.connect(core.hhUser2).swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'GmxV2IsolationModeVaultV1: Only owner or unwrapper can call',
      );
    });

    it('should fail if vault is frozen and called by owner', async () => {
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
          zapParams.userConfig,
        ),
        'GmxV2IsolationModeVaultV1: Only unwrapper if frozen',
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
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
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

  describe('#isExternalRedemptionPaused', () => {
    it('should return false with real gmx reader', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return false if short and long are outside pnl range', async () => {
      await gmxRegistryV2.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(VALID_POOL_FACTOR, VALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should return true if short is within pnl range', async () => {
      await gmxRegistryV2.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(INVALID_POOL_FACTOR, VALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return true if long is within pnl range', async () => {
      await gmxRegistryV2.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(VALID_POOL_FACTOR, INVALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should return false if both are within pnl range', async () => {
      await gmxRegistryV2.connect(core.governance).ownerSetGmxReader(testReader.address);
      await testReader.setPnlToPoolFactors(INVALID_POOL_FACTOR, INVALID_POOL_FACTOR);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });

  describe('#setIsDepositSourceWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setIsDepositSourceWrapper(true);
      await expectEvent(vault, result, 'IsDepositSourceWrapperSet', {
        isDepositSourceWrapper: true,
      });
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setIsDepositSourceWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      const result = await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectEvent(vault, result, 'ShouldSkipTransferSet', {
        shouldSkipTransfer: true,
      });
      expect(await vault.isShouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
