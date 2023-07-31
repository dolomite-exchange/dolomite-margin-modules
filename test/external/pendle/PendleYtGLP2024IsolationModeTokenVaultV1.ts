import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createTestToken } from '../../../src/utils/dolomite-utils';
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
  PendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleSyToken__factory,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  PendleYtGLPPriceOracle,
  IERC20,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  DolomiteRegistryImplementation,
} from '../../../src/types';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { expectThrow, expectWalletBalance } from 'test/utils/assertions';

const ONE_WEEK = 7 * 24 * 3600;

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtGLP2024IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendleYtToken;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtGLP2024IsolationModeWrapperTraderV2;
  let priceOracle: PendleYtGLPPriceOracle;
  let factory: PendleYtGLP2024IsolationModeVaultFactory;
  let vault: PendleYtGLP2024IsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let router: BaseRouter;

  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let anotherToken: CustomTestToken;
  let anotherMarketId: BigNumber;
  let implementation: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.ytGlpToken.connect(core.hhUser1);
    rewardToken = core.tokens.weth.connect(core.hhUser1);
    const userVaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendleYtGLP2024IsolationModeVaultFactory(
      pendleRegistry,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
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
    vault = setupUserVaultProxy<PendleYtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendleYtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    otherToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle!.setPrice(
      otherToken.address,
      '1000000000000000000000000000000'
    ); // $1.00 in USDC
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    anotherToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle!.setPrice(
      anotherToken.address,
      '1000000000000000000000000000000'
    ); // $1.00 in USDC
    anotherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, anotherToken, false);

    const syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
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
      const rewardDeposit = [{ marketId: core.marketIds.weth, depositIntoDolomite: true }];
      await vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, rewardDeposit);

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
      const rewardDeposit = [{ marketId: core.marketIds.weth, depositIntoDolomite: false }];
      await vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true, rewardDeposit);

      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.gt(ZERO_BI);
      expectWalletBalance(vault.address, core.tokens.weth, ZERO_BI);
    });

    it('should fail when not called by vault owner', async () => {
      const rewardDeposit = [{ marketId: core.marketIds.weth, depositIntoDolomite: false }];
      await expectThrow(
        vault.connect(core.hhUser2).redeemDueInterestAndRewards(true, true, rewardDeposit),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To
      );
    });

    it('should use existing expiry if borrow position already exists', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityDate(timestamp + 12 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId, anotherMarketId]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId)).to.eq(timestamp + 4 * ONE_WEEK);
      await increaseToTimestamp(timestamp + 2 * ONE_WEEK);

      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        anotherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should set expiration to 4 weeks if ytMaturityDate is more than 5 weeks away', async () => {
      let timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityDate(timestamp + 6 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To
      );
      timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId)).to.eq(timestamp + 4 * ONE_WEEK);
    });

    it('should set expiration to ytMaturityDate - 1 week if expiry is less than 5 weeks away', async () => {
      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityDate(timestamp + 3 * ONE_WEEK);
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId]);

      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To
      );

      const accountInfo = { owner: vault.address, number: borrowAccountNumber };
      expect(await core.expiry.getExpiry(accountInfo, otherMarketId)).to.eq(timestamp + 2 * ONE_WEEK);
    });

    it('should fail when not called by vault owner', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectThrow(
        vault.connect(core.hhUser2).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.To
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });

    it('should fail if within 1 week of ytMaturityDate', async () => {
      await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([otherMarketId]);
      await vault.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await factory.connect(core.governance).ownerSetYtMaturityDate(timestamp + 7 * 24 * 3600);

      await expectThrow(
        vault.connect(core.hhUser1).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.To
        ),
      'PendleYtGLP2024UserVaultV1: too close to expiry'
      );
    });
  });
});
