import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import {
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2MarketTokenPriceOracle,
  IGmxMarketToken,
} from 'src/types';
import { depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { impersonate, mineBlocks, revertToSnapshotAndCapture, setEtherBalance, snapshot } from 'test/utils';
import { expectProtocolBalance, expectThrow } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2MarketTokenPriceOracle,
  getOracleParams,
  getWithdrawalObject,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from 'test/utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const DUMMY_WITHDRAWAL_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';
const CALLBACK_GAS_LIMIT = BigNumber.from('1500000');
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
  let vault: GmxV2IsolationModeTokenVaultV1;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let marketId: BigNumber;

  const blockNumber = 131050900;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber,
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
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
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
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetCallbackGasLimit(CALLBACK_GAS_LIMIT);
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
          gmxRegistryV2.address,
          core.tokens.weth.address,
          factory.address,
          core.dolomiteMargin.address
        ),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#exchange', () => {
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

    it('should fail if output token is incorrect', async () => {
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
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
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
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelWithdrawal(withdrawalKey);

      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, core.marketIds.weth, 0);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
    });

    it('should work normally when execution fails because minAmountOut', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        parseEther('100000'),
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 1000000000 },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
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
          withdrawalInfo.eventData
        ),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`
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
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key',
      );
    });

    it('should fail when virtual and real balances do not match', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, vault.address, defaultAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        defaultAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await setupGMBalance(core, vault.address, ONE_BI, vault);
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
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Virtual vs real balance mismatch',
      );
    });
  });

  describe('#afterWithdrawalExecution', () => {
    it('should work normally with actual oracle params and long token', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 1000000000 },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.weth
      )).value).to.be.gte(ONE_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should work normally with actual oracle params and short token', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor).executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 1000000000 },
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(
        { owner: vault.address, number: borrowAccountNumber },
        core.marketIds.nativeUsdc!
      )).value).to.be.gte(ONE_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should fail if given invalid event data', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei.mul(2), vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei.mul(2));
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.mul(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);

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
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected return data',
      );

      withdrawalInfo.eventData.addressItems.items[0].key = 'outputToken';
      withdrawalInfo.eventData.addressItems.items[1].key = 'badSecondaryOutputToken';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected return data',
      );

      withdrawalInfo.eventData.addressItems.items[1].key = 'secondaryOutputToken';
      withdrawalInfo.eventData.uintItems.items[0].key = 'badOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected return data',
      );

      withdrawalInfo.eventData.uintItems.items[0].key = 'outputAmount';
      withdrawalInfo.eventData.uintItems.items[1].key = 'badSecondaryOutputAmount';
      await expectThrow(
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          withdrawalKey,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Unexpected return data',
      );
    });

    it('should fail if more than one output token received', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei.mul(2), vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei.mul(2));
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei.mul(2),
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));

      await expect(() => vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.nativeUsdc!.address,
        ONE_BI,
        ONE_BI,
        { value: parseEther('.01') },
      )).to.changeTokenBalance(underlyingToken, vault, ZERO_BI.sub(amountWei));

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei.mul(2));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);

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
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Can only receive one token',
      );
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
        unwrapper.connect(core.hhUser1).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`
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
        unwrapper.connect(withdrawalExecutor).afterWithdrawalExecution(
          DUMMY_WITHDRAWAL_KEY,
          withdrawalInfo.withdrawal,
          withdrawalInfo.eventData
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid withdrawal key'
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
        `GmxV2IsolationModeUnwrapperV2: Account owner is not a vault <${core.hhUser2.address.toLowerCase()}>`
      );
    });

    it('should fail if transfer amount is zero', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid transfer amount'
      );
    });

    it('should fail if virtual underlying balance is insufficient', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256'], [amountWei]),
        ),
        `GmxV2IsolationModeUnwrapperV2: Insufficient balance <${ZERO_BI}, ${amountWei.toString()}>`,
      );
    });
  });

  describe('#vaultSetWithdrawalInfo', () => {
    it('should fail if not called by vault', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).vaultSetWithdrawalInfo(
          DUMMY_WITHDRAWAL_KEY,
          defaultAccountNumber,
          core.tokens.weth.address
        ),
        'GmxV2IsolationModeUnwrapperV2: Invalid vault',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should revert', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(factory.address, core.tokens.weth.address, ONE_ETH_BI, BYTES_EMPTY),
        'GmxV2IsolationModeUnwrapperV2: getExchangeCost is not implemented'
      );
    });
  });
});
