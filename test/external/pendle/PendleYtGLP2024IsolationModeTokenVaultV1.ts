import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createContractWithAbi, createTestToken, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { createDolomiteRegistryImplementation } from 'test/utils/dolomite';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  increaseToTimestamp,
  getBlockTimestamp,
} from 'test/utils';
import {
  createPendleGLPRegistry,
  createPendleYtGLP2024IsolationModeTokenVaultV1,
  createPendleYtGLP2024IsolationModeUnwrapperTraderV2,
  createPendleYtGLP2024IsolationModeVaultFactory,
  createPendleYtGLP2024IsolationModeWrapperTraderV2,
  createPendleYtGLPPriceOracle,
} from 'test/utils/ecosystem-token-utils/pendle';
import {
  DolomiteRegistryImplementation__factory,
  RegistryProxy__factory,
  CustomTestToken,
  PendleYtGLP2024IsolationModeVaultFactory,
  TestPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleSyToken__factory,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  PendleYtGLPPriceOracle,
  IERC20,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  DolomiteRegistryImplementation,
  IPendleSyToken,
  IPendleYtToken__factory,
  TestPendleYtGLP2024IsolationModeTokenVaultV1__factory,
} from '../../../src/types';
import { Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { expectProtocolBalance, expectThrow, expectWalletBalance } from 'test/utils/assertions';
import { getSimpleZapParams } from 'test/utils/zap-utils';

const ONE_WEEK = 7 * 24 * 3600;

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const initialAllowableDebtMarketIds = [0, 1];

describe('PendleYtGLP2024IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendleYtToken;
  let syGlp: IPendleSyToken;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtGLP2024IsolationModeWrapperTraderV2;
  let priceOracle: PendleYtGLPPriceOracle;
  let factory: PendleYtGLP2024IsolationModeVaultFactory;
  let vault: TestPendleYtGLP2024IsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let router: BaseRouter;

  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherToken2: CustomTestToken;
  let otherMarketId2: BigNumber;
  let implementation: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.ytGlpToken.connect(core.hhUser1);
    rewardToken = core.tokens.weth.connect(core.hhUser1);
    const userVaultImplementation = await createContractWithAbi<TestPendleYtGLP2024IsolationModeTokenVaultV1>(
      TestPendleYtGLP2024IsolationModeTokenVaultV1__factory.abi,
      TestPendleYtGLP2024IsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendleYtGLP2024IsolationModeVaultFactory(
      pendleRegistry,
      initialAllowableDebtMarketIds,
      [],
      core,
      core.pendleEcosystem!.ytGlpToken,
      userVaultImplementation
    );
    unwrapper = await createPendleYtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendleYtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendleYtGLPPriceOracle(core, factory, pendleRegistry);
    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const doloRegistry = RegistryProxy__factory.connect(core.dolomiteRegistry.address, core.governance);
    implementation = await createDolomiteRegistryImplementation();
    await doloRegistry.upgradeTo(implementation.address);
    const registryImpl = DolomiteRegistryImplementation__factory.connect(
      core.dolomiteRegistry.address,
      core.governance
    );
    await registryImpl.ownerSetExpiry(core.expiry.address);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestPendleYtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      TestPendleYtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle!.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000'
    ); // $1.00 in USDC
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle!.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000'
    ); // $1.00 in USDC
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
    await syGlp.connect(core.hhUser1).deposit(
      core.hhUser1.address,
      ethers.constants.AddressZero,
      ethers.utils.parseEther('1'),
      0,
      { value: parseEther('1') }
    );
    const syGLPBal = await syGlp.balanceOf(core.hhUser1.address);
    await syGlp.connect(core.hhUser1).approve(router.address, ethers.constants.MaxUint256);
    await router.mintPyFromSy(underlyingToken.address as any, syGLPBal, 5);

    await underlyingToken.connect(core.hhUser1).approve(vault.address, ethers.constants.MaxUint256);
    const ytBal = await underlyingToken.balanceOf(core.hhUser1.address);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ytBal);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should work when owner paused syGLP', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
      const owner = await impersonate(await syGlp.owner(), true);
      await syGlp.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });

  describe('#redeemDueInterestAndRewards', () => {
    it('should work normally', async () => {
      expectWalletBalance(vault.address, core.tokens.weth, ZERO_BI);
      expectWalletBalance(core.hhUser1.address, core.tokens.weth, ZERO_BI);

      await increaseToTimestamp((await underlyingToken.expiry()).toNumber());
      await vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, [true], false);

      const account = { owner: core.hhUser1.address, number: defaultAccountNumber };
      const balance = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
      expect(balance.sign).to.eq(true);
      expect(balance.value).to.be.gt(ZERO_BI);
      expectWalletBalance(vault.address, core.tokens.weth, ZERO_BI);
      expectWalletBalance(core.hhUser1.address, core.tokens.weth, ZERO_BI);
    });

    it('should send rewards to user', async () => {
      expectWalletBalance(vault.address, core.tokens.weth, ZERO_BI);
      expectWalletBalance(core.hhUser1.address, core.tokens.weth, ZERO_BI);

      await increaseToTimestamp((await underlyingToken.expiry()).toNumber());
      await vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, [false], false);

      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.gt(ZERO_BI);
      expectWalletBalance(vault.address, core.tokens.weth, ZERO_BI);
    });

    it('should fail when sending interest to user cause syGLP is invalid market', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, [false], true),
        'Getters: Invalid token'
      );
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).redeemDueInterestAndRewards(true, true, [false], false),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });

    it('should fail if _depositIntoDolomite length does not equal rewardTokens length', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, [], false),
        'PendleYtGLP2024UserVaultV1: Array length mismatch'
      );
    });

    it('should fail when reentrancy is triggered', async () => {
      await expectThrow(
        vault.callRedeemDueInterestAndRewardsTriggerReentrancy(
          true, true, [true], false
        ),
        'IsolationModeTokenVaultV1: Reentrant call'
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 8 * 24 * 3600);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
    });

    it('should fail if within 1 week of ytMaturityDate', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 7 * 24 * 3600);

      await expectThrow(
        vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'PendleYtGLP2024UserVaultV1: Too close to expiry'
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await vault.connect(core.hhUser1).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(2));
    });

    it('should work normally with debt', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await vault.connect(core.hhUser1).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI.sub(inputAmount));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(2));
    });

    it('should set expiration to 4 weeks if maturity is more than 5 weeks away and balance goes negative', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 6 * ONE_WEEK);

      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await vault.connect(core.hhUser1).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI.sub(inputAmount));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should use existing expiry if borrow position already exists and balance goes negative', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 12 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      await increaseToTimestamp(timestamp + 2 * ONE_WEEK);

      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId2, inputAmount, otherMarketId1, inputAmount, core);
      await vault.connect(core.hhUser1).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI.sub(inputAmount));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, ZERO_BI.sub(inputAmount));
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId2)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should set expiration to maturity - 1 week if expiry < 5 weeks away and balance goes negative', async () => {
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 3 * ONE_WEEK);

      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await vault.connect(core.hhUser1).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, ZERO_BI.sub(inputAmount));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId2, otherAmountWei.mul(2));
      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 2 * ONE_WEEK);
    });

    it('should fail when not called by vault owner', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
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
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if within 1 week of ytMaturityTimestamp and balance goes negative', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp);

      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        vault.connect(core.hhUser1).swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'PendleYtGLP2024UserVaultV1: Too close to expiry',
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
    });

    it('should withdraw collateral normally', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);

      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both
      );

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect((await core.dolomiteMargin.getAccountWei(accountInfo, otherMarketId1)).value).to.eq(ZERO_BI);
    });

    it('should allow withdrawing collateral after market expiration', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, otherMarketId1, otherAmountWei);

      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both
      );

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect((await core.dolomiteMargin.getAccountWei(accountInfo, otherMarketId1)).value).to.eq(ZERO_BI);
    });

    it('should use existing expiry if borrow position already exists', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 12 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      await increaseToTimestamp(timestamp + 2 * ONE_WEEK);

      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId2)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should leave expiration the same when borrowing more from same position', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 12 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      await increaseToTimestamp(timestamp + 2 * ONE_WEEK);

      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should set expiration to 4 weeks if ytMaturityTimestamp is more than 5 weeks away', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 6 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should set expiration to ytMaturityDate - 1 week if expiry is less than 5 weeks away', async () => {
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 3 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 2 * ONE_WEEK);
    });

    it('should fail when not called by vault owner', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectThrow(
        vault.connect(core.hhUser2).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.To
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });

    it('should fail if within 1 week of ytMaturityDate', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 7 * 24 * 3600);

      await expectThrow(
        vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.To
        ),
        'PendleYtGLP2024UserVaultV1: Too close to expiry'
      );
    });

    it('should fail if within safety buffer seconds of existing expiration', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityTimestamp(timestamp + 12 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId1, otherMarketId2]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId1)).to.eq(timestamp + 4 * ONE_WEEK);
      await increaseToTimestamp(timestamp + 4 * ONE_WEEK - 100);

      await expectThrow(
        vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          ONE_BI,
          BalanceCheckFlag.To
        ),
        'PendleYtGLP2024UserVaultV1: Position is about to expire',
      );
    });

  });
});
