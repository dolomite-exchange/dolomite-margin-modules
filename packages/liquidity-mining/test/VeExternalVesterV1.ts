import { CustomTestToken } from '@dolomite-exchange/modules-base/src/types';
import {
  ADDRESS_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  increaseByTimeDelta,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
  expectWalletBalanceIsBetween,
  expectWalletBalanceIsGreaterThan,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupUSDCBalance,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createTestToken, withdrawFromDolomiteMargin } from '../../base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from '../../base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  ExternalOARB,
  IDolomiteInterestSetter,
  IDolomitePriceOracle,
  IERC20,
  IERC20Metadata__factory,
  IVesterDiscountCalculator,
  IVeToken,
  TestVeExternalVesterImplementationV1,
} from '../src/types';
import {
  createExternalOARB,
  createTestDiscountCalculator,
  createTestVeExternalVesterV1Proxy,
  createTestVeToken,
  createVesterDiscountCalculatorV1,
} from './liquidity-mining-ecosystem-utils';
import { expectEmptyExternalVesterPosition } from './liquidityMining-utils';

const defaultAccountNumber = ZERO_BI;
const ONE_WEEK = BigNumber.from('604800');
const FOUR_WEEKS = ONE_WEEK.mul(4);
const CLOSE_POSITION_WINDOW = FOUR_WEEKS;
const FORCE_CLOSE_POSITION_TAX = BigNumber.from('500');
const EMERGENCY_WITHDRAW_TAX = BigNumber.from('0');
const NAME = 'oARB Vesting';
const SYMBOL = 'vgoARB';
const BASE_URI = 'oARB LIQUIDITY MINING RULEZ';
const NO_MARKET_ID = MAX_UINT_256_BI;

const O_TOKEN_AMOUNT = parseEther('1');
const PAIR_AMOUNT = BigNumber.from('1500000'); // 1.5 USDC
const MAX_PAIR_AMOUNT = PAIR_AMOUNT.mul(11).div(10); // 10% increase
const PAYMENT_AMOUNT_BEFORE_DISCOUNT = parseEther('0.0015'); // 0.0015 ETH
const MAX_PAYMENT_AMOUNT = PAYMENT_AMOUNT_BEFORE_DISCOUNT.mul(11).div(10); // 10% increase
const REWARD_AMOUNT = O_TOKEN_AMOUNT;
const TOTAL_REWARD_AMOUNT = parseEther('1000');

const NFT_ID = ONE_BI;
const VE_TOKEN_ID = ONE_BI;

const PAYMENT_TOKEN_PRICE = parseEther('1000'); // $1,000
const PAIR_TOKEN_PRICE = BigNumber.from('1000000000000000000000000000000'); // $1
const REWARD_TOKEN_PRICE = parseEther('1.50'); // $1.50

describe('VeExternalVesterV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let vester: TestVeExternalVesterImplementationV1;
  let discountCalculator: IVesterDiscountCalculator;
  let oToken: ExternalOARB;
  let testToken: CustomTestToken;
  let pairMarketId: BigNumberish;
  let pairToken: IERC20;
  let paymentMarketId: BigNumberish;
  let paymentToken: IERC20;
  let rewardMarketId: BigNumberish;
  let rewardToken: IERC20;
  let veToken: IVeToken;
  let owner: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 219_404_000,
    });
    testToken = await createTestToken(6);

    pairToken = testToken;
    paymentToken = core.tokens.weth;
    rewardToken = testToken;
    pairMarketId = NO_MARKET_ID;
    paymentMarketId = core.marketIds.weth;
    rewardMarketId = NO_MARKET_ID;

    const interestRate = parseEther('0.30').div(ONE_DAY_SECONDS * 365); // 30% APR
    const testInterestSetter = core.testEcosystem!.testInterestSetter;
    await testInterestSetter.setInterestRate(pairToken.address, { value: interestRate });
    await testInterestSetter.setInterestRate(paymentToken.address, { value: interestRate });
    await testInterestSetter.setInterestRate(rewardToken.address, { value: interestRate });
    await setInterestSetter(pairMarketId, testInterestSetter);
    await setInterestSetter(paymentMarketId, testInterestSetter);
    await setInterestSetter(rewardMarketId, testInterestSetter);

    const testPriceOracle = core.testEcosystem!.testPriceOracle;
    await testPriceOracle.setPrice(pairToken.address, PAIR_TOKEN_PRICE);
    await testPriceOracle.setPrice(paymentToken.address, PAYMENT_TOKEN_PRICE);
    await testPriceOracle.setPrice(rewardToken.address, REWARD_TOKEN_PRICE);
    await setPriceOracle(pairToken, pairMarketId, testPriceOracle);
    await setPriceOracle(paymentToken, paymentMarketId, testPriceOracle);
    await setPriceOracle(rewardToken, rewardMarketId, testPriceOracle);

    discountCalculator = await createVesterDiscountCalculatorV1();
    owner = core.governance;
    oToken = await createExternalOARB(owner, 'Test oARB', 'oARB');
    veToken = await createTestVeToken(rewardToken);

    vester = await createTestVeExternalVesterV1Proxy(
      core,
      pairToken,
      pairMarketId,
      paymentToken,
      paymentMarketId,
      rewardToken,
      rewardMarketId,
      veToken,
      discountCalculator,
      oToken,
      BASE_URI,
      NAME,
      SYMBOL,
    );
    await vester.connect(owner).ownerSetClosePositionWindow(CLOSE_POSITION_WINDOW);

    await core.dolomiteMargin.connect(owner).ownerSetGlobalOperator(vester.address, true);
    await withdrawFromDolomiteMargin(
      core,
      owner,
      defaultAccountNumber,
      core.marketIds.weth,
      MAX_UINT_256_BI,
      core.hhUser5.address,
    );

    await oToken.connect(owner).ownerSetHandler(owner.address, true);
    await oToken.connect(owner).ownerSetHandler(vester.address, true);
    await oToken.connect(owner).mint(O_TOKEN_AMOUNT.mul(2));
    await oToken.connect(owner).transfer(core.hhUser1.address, O_TOKEN_AMOUNT);
    await oToken.connect(owner).transfer(core.hhUser2.address, O_TOKEN_AMOUNT);
    await expectWalletBalance(core.hhUser1.address, oToken, O_TOKEN_AMOUNT);
    await expectWalletBalance(core.hhUser2.address, oToken, O_TOKEN_AMOUNT);

    // Pair token
    await setupUSDCBalance(core, core.hhUser1, PAIR_AMOUNT.mul(2), vester);
    await setupUSDCBalance(core, core.hhUser2, PAIR_AMOUNT.mul(2), vester);

    // Payment token
    await setupWETHBalance(core, core.hhUser1, MAX_PAYMENT_AMOUNT, vester);
    await setupWETHBalance(core, core.hhUser2, MAX_PAYMENT_AMOUNT, vester);

    // Reward token
    await testToken.connect(owner).mint(TOTAL_REWARD_AMOUNT, owner.address);
    await testToken.connect(owner).approve(vester.address, TOTAL_REWARD_AMOUNT);
    await vester.connect(owner).ownerDepositRewardToken(TOTAL_REWARD_AMOUNT);

    await expectWalletBalance(owner, oToken, ZERO_BI);
    await expectWalletBalance(owner, pairToken, ZERO_BI);
    await expectWalletBalance(owner, paymentToken, ZERO_BI);
    await expectWalletBalance(owner, rewardToken, ZERO_BI);

    await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, ZERO_BI);

    await expectWalletBalance(vester, pairToken, TOTAL_REWARD_AMOUNT);
    await expectWalletBalance(vester, paymentToken, ZERO_BI);
    await expectWalletBalance(vester, rewardToken, TOTAL_REWARD_AMOUNT);

    await expectProtocolBalance(core, vester, defaultAccountNumber, paymentMarketId, ZERO_BI);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await vester.PAYMENT_TOKEN()).to.eq(paymentToken.address);
      expect(await vester.PAIR_TOKEN()).to.eq(pairToken.address);
      expect(await vester.REWARD_TOKEN()).to.eq(rewardToken.address);
      expect(await vester.PAYMENT_MARKET_ID()).to.eq(paymentMarketId);
      expect(await vester.PAIR_MARKET_ID()).to.eq(pairMarketId);
      expect(await vester.REWARD_MARKET_ID()).to.eq(rewardMarketId);
      expect(await vester.VE_TOKEN()).to.eq(veToken.address);

      expect(await vester.discountCalculator()).to.eq(discountCalculator.address);
      expect(await vester.oToken()).to.eq(oToken.address);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.isVestingActive()).to.be.true;
      expect(await vester.closePositionWindow()).to.eq(CLOSE_POSITION_WINDOW);
      expect(await vester.forceClosePositionTax()).to.eq(FORCE_CLOSE_POSITION_TAX);
      expect(await vester.emergencyWithdrawTax()).to.eq(EMERGENCY_WITHDRAW_TAX);
      expect(await vester.baseURI()).to.eq(BASE_URI);
      expect(await vester.symbol()).to.eq(SYMBOL);
      expect(await vester.name()).to.eq(NAME);
    });

    it('should fail if already initialized', async () => {
      const bytes = ethers.utils.defaultAbiCoder.encode(['address', 'string'], [ZERO_ADDRESS, 'hello there']);
      await expectThrow(vester.connect(owner).initialize(bytes), 'Initializable: contract is already initialized');
    });
  });

  describe('#vest', () => {
    it('should work with 4 week duration', async () => {
      await setupAllowancesForVesting();
      const result = await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectEvent(vester, result, 'VestingStarted', {
        owner: core.hhUser1.address,
        duration: FOUR_WEEKS,
        oTokenAmount: O_TOKEN_AMOUNT,
        pairAmount: PAIR_AMOUNT,
        vestingId: NFT_ID,
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, pairToken, PAIR_AMOUNT);

      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);

      expect(await vester.ownerOf(NFT_ID)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oToken, O_TOKEN_AMOUNT);
      await expectWalletBalance(vester, pairToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, PAIR_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(REWARD_AMOUNT);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_TOKEN_AMOUNT));

      const position = await vester.vestingPositions(NFT_ID);
      expect(position.creator).to.eq(core.hhUser1.address);
      expect(position.id).to.eq(NFT_ID);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(FOUR_WEEKS);
      expect(position.oTokenAmount).to.eq(O_TOKEN_AMOUNT);
      expect(position.pairAmount).to.eq(PAIR_AMOUNT);
    });

    it('should fail if PAIR_TOKEN exceeds max', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).vest(FOUR_WEEKS, O_TOKEN_AMOUNT, ONE_BI),
        'VeExternalVesterImplementationV1: Pair amount exceeds max',
      );
    });

    it('should fail if vester has insufficient REWARD_TOKEN', async () => {
      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false);
      await expectThrow(
        vester.connect(core.hhUser1).vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Not enough rewards available',
      );
    });

    it('should fail if duration is different than 4 weeks', async () => {
      await expectThrow(
        vester.vest(ZERO_BI, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
      await expectThrow(
        vester.vest(FOUR_WEEKS.sub(1), O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
      await expectThrow(
        vester.vest(FOUR_WEEKS.add(1), O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
      await expectThrow(
        vester.vest(ONE_WEEK, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if duration is more than 40 weeks', async () => {
      await expectThrow(
        vester.vest(FOUR_WEEKS.mul(40).add(1), O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if duration not 1 week interval', async () => {
      await expectThrow(
        vester.vest(FOUR_WEEKS.mul(2).add(1), O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if vesting is not active', async () => {
      await vester.connect(owner).ownerSetIsVestingActive(false);
      await expectThrow(
        vester.vest(FOUR_WEEKS.mul(2).add(1), O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'VeExternalVesterImplementationV1: Vesting not active',
      );
    });

    it('should fail if reentered', async () => {
      await setupAllowancesForVesting();
      await expectThrow(
        vester.connect(core.hhUser1).callVestAndTriggerReentrancy(ONE_WEEK, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(ONE_WEEK);

      const paymentAmount = PAYMENT_AMOUNT_BEFORE_DISCOUNT.mul(7_800).div(10_000);

      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
        PAIR_AMOUNT,
        ZERO_BI,
      );

      const result = await vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, MAX_PAYMENT_AMOUNT);

      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        amountPaid: paymentAmount,
      });
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalance(vester.address, oToken, ZERO_BI);

      await expectWalletBalanceIsGreaterThan(core.hhUser1, pairToken, PAIR_AMOUNT.mul(2)); // account for interest
      await expectWalletBalance(core.hhUser1, paymentToken, MAX_PAYMENT_AMOUNT.sub(paymentAmount));
      await expectWalletBalance(core.hhUser1, rewardToken, REWARD_AMOUNT);

      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, paymentAmount);
      await expectProtocolBalance(core, owner, ZERO_BI, paymentMarketId, paymentAmount);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should work normally for full refund (40 weeks)', async () => {
      await setupAllowancesForVesting();
      const time = ONE_WEEK.mul(40);
      await vester.vest(time, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(time);

      const paymentAmount = ZERO_BI;

      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
        PAIR_AMOUNT,
        ZERO_BI,
      );

      const result = await vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, paymentAmount);

      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        amountPaid: paymentAmount,
      });
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalance(vester.address, oToken, ZERO_BI);

      await expectWalletBalanceIsGreaterThan(core.hhUser1, pairToken, PAIR_AMOUNT.mul(2)); // account for interest
      await expectWalletBalance(core.hhUser1, paymentToken, MAX_PAYMENT_AMOUNT.sub(paymentAmount));
      await expectWalletBalance(core.hhUser1, rewardToken, REWARD_AMOUNT);

      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, paymentAmount);
      await expectProtocolBalance(core, owner, ZERO_BI, paymentMarketId, paymentAmount);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should fail if the discount is invalid', async () => {
      await setupAllowancesForVesting();
      const time = ONE_WEEK.mul(40);
      await vester.vest(time, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(time);

      const paymentAmount = ZERO_BI;

      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
        PAIR_AMOUNT,
        ZERO_BI,
      );
      const tester = await createTestDiscountCalculator();
      await vester.connect(owner).ownerSetDiscountCalculator(tester.address);
      const discount = 10_001;
      await tester.setDiscount(discount);

      await expectThrow(
        vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, paymentAmount),
        `VeExternalVesterImplementationV1: Invalid discount <${discount}>`,
      );
    });

    it('should fail if cost is too high for max payment', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ONE_BI),
        'VeExternalVesterImplementationV1: Cost exceeds max payment amount',
      );
    });

    it('should fail if not called by position owner', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser2).closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, MAX_PAYMENT_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid position owner',
      );
    });

    it('should fail if before vesting time', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser1).closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, MAX_PAYMENT_AMOUNT),
        'VeExternalVesterImplementationV1: Position not vested',
      );
    });

    it('should fail if reentered', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectThrow(
        vester
          .connect(core.hhUser1)
          .callClosePositionAndBuyTokensAndTriggerReentrancy(NFT_ID, VE_TOKEN_ID, MAX_UINT_256_BI),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#forceClosePosition', () => {
    it('should work normally', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(CLOSE_POSITION_WINDOW.add(ONE_WEEK).add(1));

      const result = await vester.connect(core.hhUser5).forceClosePosition(NFT_ID);
      const taxAmount = PAIR_AMOUNT.mul(5).div(100);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: taxAmount,
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalanceIsBetween(
        core.hhUser1,
        pairToken,
        PAIR_AMOUNT.add(PAIR_AMOUNT).sub(taxAmount),
        PAIR_AMOUNT.add(PAIR_AMOUNT).add(PAIR_AMOUNT.mul(300).div(10_000)).sub(taxAmount),
      );

      await expectWalletBalance(owner.address, pairToken, ZERO_BI);
      await expectProtocolBalance(core, owner.address, defaultAccountNumber, pairMarketId, PAIR_AMOUNT.mul(5).div(100));

      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should work normally if tax is zero', async () => {
      await setupAllowancesForVesting();
      await vester.connect(owner).ownerSetForceClosePositionTax(ZERO_BI);
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(CLOSE_POSITION_WINDOW.add(ONE_WEEK).add(1));

      const result = await vester.connect(core.hhUser5).forceClosePosition(NFT_ID);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: ZERO_BI,
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalanceIsBetween(
        core.hhUser1,
        pairToken,
        PAIR_AMOUNT.add(PAIR_AMOUNT),
        PAIR_AMOUNT.add(PAIR_AMOUNT).add(PAIR_AMOUNT.mul(300).div(10_000)),
      );

      await expectWalletBalance(owner.address, pairToken, ZERO_BI);
      await expectProtocolBalance(core, owner.address, defaultAccountNumber, pairMarketId, ZERO_BI);

      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should fail if position is not expirable', async () => {
      await vester.connect(owner).ownerSetClosePositionWindow(ZERO_BI);
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(NFT_ID),
        'VeExternalVesterImplementationV1: Positions are not expirable',
      );
    });

    it('should fail if position is not expired', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await increase(CLOSE_POSITION_WINDOW.sub(2)); // Not sure why this is off by a bit
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(NFT_ID),
        'VeExternalVesterImplementationV1: Position not expired',
      );
    });
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(ONE_DAY_SECONDS);

      const result = await vester.connect(core.hhUser1).emergencyWithdraw(NFT_ID);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: ZERO_BI,
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalanceIsBetween(
        core.hhUser1,
        pairToken,
        PAIR_AMOUNT.add(PAIR_AMOUNT),
        PAIR_AMOUNT.add(PAIR_AMOUNT).add(PAIR_AMOUNT.mul(100).div(10_000)),
      );

      await expectWalletBalance(owner.address, pairToken, ZERO_BI);
      await expectProtocolBalance(core, owner.address, defaultAccountNumber, pairMarketId, ZERO_BI);

      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should work normally with tax', async () => {
      await vester.connect(owner).ownerSetEmergencyWithdrawTax(500); // 5%
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(ONE_DAY_SECONDS);

      const result = await vester.connect(core.hhUser1).emergencyWithdraw(NFT_ID);
      const taxAmount = PAIR_AMOUNT.mul(5).div(100);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: taxAmount,
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalanceIsBetween(
        core.hhUser1,
        pairToken,
        PAIR_AMOUNT.add(PAIR_AMOUNT).sub(taxAmount),
        PAIR_AMOUNT.add(PAIR_AMOUNT).add(PAIR_AMOUNT.mul(100).div(10_000)).sub(taxAmount),
      );

      await expectWalletBalance(owner.address, pairToken, ZERO_BI);
      await expectProtocolBalance(core, owner.address, defaultAccountNumber, pairMarketId, PAIR_AMOUNT.mul(5).div(100));

      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should fail if not called by position owner', async () => {
      await expectThrow(vester.emergencyWithdraw(NFT_ID), 'ERC721: invalid token ID');

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser2).emergencyWithdraw(NFT_ID),
        'VeExternalVesterImplementationV1: Invalid position owner',
      );
    });
  });

  describe('#ownerSetForceClosePositionTax', () => {
    it('should fail if tax is greater than base', async () => {
      await expectThrow(
        vester.connect(owner).ownerSetForceClosePositionTax(100_000),
        'VeExternalVesterImplementationV1: Invalid force close position tax',
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetForceClosePositionTax(500),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerDepositRewardToken', () => {
    it('should work normally', async () => {
      await testToken.connect(owner).mint(REWARD_AMOUNT, owner.address);
      await testToken.connect(owner).approve(vester.address, REWARD_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      await vester.connect(owner).ownerDepositRewardToken(REWARD_AMOUNT);
      await increaseByTimeDelta(ONE_DAY_SECONDS);

      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.add(REWARD_AMOUNT));
      await expectWalletBalance(owner, rewardToken, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vester.address, number: defaultAccountNumber },
        rewardMarketId,
        TOTAL_REWARD_AMOUNT.add(REWARD_AMOUNT).add(TOTAL_REWARD_AMOUNT.mul(2).div(10_000)),
        ZERO_BI,
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerDepositRewardToken(TOTAL_REWARD_AMOUNT),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerWithdrawRewardToken', () => {
    it('should work normally when bypasses available amount', async () => {
      await increaseByTimeDelta(ONE_DAY_SECONDS);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, true);

      await expectWalletBalance(owner.address, rewardToken, TOTAL_REWARD_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vester.address, number: defaultAccountNumber },
        rewardMarketId,
        TOTAL_REWARD_AMOUNT.mul(2).div(10_000),
        ZERO_BI,
      );

      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, MAX_UINT_256_BI, true);
      await expectWalletBalanceIsBetween(
        owner.address,
        rewardToken,
        TOTAL_REWARD_AMOUNT.add(TOTAL_REWARD_AMOUNT.mul(2).div(10_000)),
        TOTAL_REWARD_AMOUNT.add(TOTAL_REWARD_AMOUNT.mul(5).div(10_000)),
      );
    });

    it('should work normally when bypasses available amount', async () => {
      await expectWalletBalance(vester, pairToken, ZERO_BI);
      await expectWalletBalance(core.hhUser3, pairToken, ZERO_BI);

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(FOUR_WEEKS, O_TOKEN_AMOUNT, PAIR_AMOUNT);
      await vester.connect(owner).ownerWithdrawRewardToken(core.hhUser3.address, O_TOKEN_AMOUNT, false);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_TOKEN_AMOUNT));
      await expectWalletBalance(core.hhUser3, rewardToken, O_TOKEN_AMOUNT);
    });

    it('should fail if attempting to withdraw all before the pushed tokens are cleared', async () => {
      await expectThrow(
        vester.connect(owner).ownerWithdrawRewardToken(owner.address, MAX_UINT_256_BI, true),
        'VeExternalVesterImplementationV1: Interest cannot be withdrawn yet',
      );
    });

    it('should fail if attempting to withdraw more than available tokens', async () => {
      await expectThrow(
        vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT.mul(10), false),
        'VeExternalVesterImplementationV1: Insufficient available tokens',
      );

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(FOUR_WEEKS, O_TOKEN_AMOUNT, PAIR_AMOUNT);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_TOKEN_AMOUNT));
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      await expectThrow(
        vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false),
        'VeExternalVesterImplementationV1: Insufficient available tokens',
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerWithdrawRewardToken(owner.address, ONE_ETH_BI, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAccrueRewardTokenInterest', () => {
    it('should work normally when pushed rewards have been claimed amount', async () => {
      await increaseByTimeDelta(ONE_DAY_SECONDS);
      await expectWalletBalance(owner.address, rewardToken, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false);
      await vester.connect(owner).ownerAccrueRewardTokenInterest(core.hhUser3.address);

      await expectProtocolBalance(core, vester, defaultAccountNumber, rewardMarketId, ZERO_BI);
      await expectWalletBalance(owner.address, rewardToken, TOTAL_REWARD_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(ZERO_BI);
      await expectWalletBalanceIsBetween(
        core.hhUser3.address,
        rewardToken,
        TOTAL_REWARD_AMOUNT.mul(2).div(10_000),
        TOTAL_REWARD_AMOUNT.mul(3).div(10_000),
      );
    });

    it('should fail if attempting to withdraw all before the pushed tokens are cleared', async () => {
      await expectThrow(
        vester.connect(owner).ownerAccrueRewardTokenInterest(owner.address),
        `VeExternalVesterImplementationV1: Interest cannot be withdrawn yet <${TOTAL_REWARD_AMOUNT}>`,
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerAccrueRewardTokenInterest(owner.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetIsVestingActive', () => {
    it('should work normally', async () => {
      expect(await vester.isVestingActive()).to.eq(true);
      const result = await vester.connect(owner).ownerSetIsVestingActive(false);
      await expectEvent(vester, result, 'VestingActiveSet', {
        isVestingActive: false,
      });
      expect(await vester.isVestingActive()).to.eq(false);
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetIsVestingActive(false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetDiscountCalculator', () => {
    it('should work normally', async () => {
      const tester = await createTestDiscountCalculator();
      expect(await vester.discountCalculator()).to.eq(discountCalculator.address);
      const result = await vester.connect(owner).ownerSetDiscountCalculator(tester.address);
      await expectEvent(vester, result, 'DiscountCalculatorSet', {
        discountCalculator: tester.address,
      });
      expect(await vester.discountCalculator()).to.eq(tester.address);
    });

    it('should fail if the discount calculator is invalid', async () => {
      await expectThrow(
        vester.connect(owner).ownerSetDiscountCalculator(ADDRESS_ZERO),
        'VeExternalVesterImplementationV1: Invalid discount calculator',
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetDiscountCalculator(discountCalculator.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetClosePositionWindow', () => {
    it('should work normally', async () => {
      const result = await vester.connect(owner).ownerSetClosePositionWindow(ONE_WEEK.mul(2));
      await expectEvent(vester, result, 'ClosePositionWindowSet', {
        closePositionWindow: ONE_WEEK.mul(2),
      });
      expect(await vester.closePositionWindow()).to.eq(ONE_WEEK.mul(2));
    });

    it('should work when set to 0', async () => {
      const result = await vester.connect(owner).ownerSetClosePositionWindow(ZERO_BI);
      await expectEvent(vester, result, 'ClosePositionWindowSet', {
        closePositionWindow: ZERO_BI,
      });
      expect(await vester.closePositionWindow()).to.eq(ZERO_BI);
    });

    it('should fail less than min duration', async () => {
      await expectThrow(
        vester.connect(owner).ownerSetClosePositionWindow(ONE_WEEK.sub(1)),
        'VeExternalVesterImplementationV1: Invalid close position window',
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetClosePositionWindow(ONE_WEEK),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetEmergencyWithdrawTax', () => {
    it('should work normally', async () => {
      const result = await vester.connect(owner).ownerSetEmergencyWithdrawTax(100);
      await expectEvent(vester, result, 'EmergencyWithdrawTaxSet', {
        emergencyWithdrawTax: 100,
      });
      expect(await vester.emergencyWithdrawTax()).to.eq(100);
    });

    it('should fail if outside of range', async () => {
      await expectThrow(
        vester.connect(owner).ownerSetEmergencyWithdrawTax(10_001),
        'VeExternalVesterImplementationV1: Invalid emergency withdrawal tax',
      );
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetEmergencyWithdrawTax(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetBaseURI', () => {
    const baseURI = 'hello';
    it('should work normally', async () => {
      const result = await vester.connect(owner).ownerSetBaseURI(baseURI);
      await expectEvent(vester, result, 'BaseURISet', {
        baseURI,
      });
      expect(await vester.baseURI()).to.eq(baseURI);
    });

    it('should fail if not called by the owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetBaseURI(baseURI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#tokenURI', () => {
    it('should work normally', async () => {
      const baseURI = 'hello';
      await vester.connect(owner).ownerSetBaseURI(baseURI);
      await setupAllowancesForVesting();
      await vester.vest(FOUR_WEEKS, O_TOKEN_AMOUNT, MAX_PAIR_AMOUNT);
      expect(await vester.tokenURI(1)).to.eq('hello');
    });

    it('should fail if tokenId is not minted', async () => {
      await expectThrow(vester.tokenURI(1), 'ERC721: invalid token ID');
    });
  });

  async function setupAllowancesForVesting() {
    await oToken.connect(core.hhUser1).approve(vester.address, O_TOKEN_AMOUNT);
    await pairToken.connect(core.hhUser1).approve(vester.address, MAX_PAIR_AMOUNT);
    await paymentToken.connect(core.hhUser1).approve(vester.address, MAX_PAYMENT_AMOUNT);
  }

  async function setInterestSetter(marketId: BigNumberish, interestSetter: IDolomiteInterestSetter) {
    if (!BigNumber.from(marketId).eq(NO_MARKET_ID)) {
      await core.dolomiteMargin.ownerSetInterestSetter(marketId, interestSetter.address);
    }
  }

  async function setPriceOracle(token: IERC20, marketId: BigNumberish, priceOracle: IDolomitePriceOracle) {
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: token.address,
      decimals: await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals(),
      oracleInfos: [
        {
          oracle: priceOracle.address,
          weight: 100,
          tokenPair: ADDRESS_ZERO,
        },
      ],
    });

    if (!BigNumber.from(marketId).eq(NO_MARKET_ID)) {
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.oracleAggregatorV2.address);
    }
  }

  function getVesterAccountNumber(user: SignerWithAddressWithSafety, nftId: BigNumberish): BigNumber {
    return BigNumber.from(ethers.utils.solidityKeccak256(['address', 'uint256'], [user.address, nftId]));
  }
});
