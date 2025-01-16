import { parseEther } from 'ethers/lib/utils';
import {
  DOLO,
  IDolomitePriceOracle,
  IERC20,
  IERC20Metadata__factory,
  IVesterDiscountCalculator,
  ODOLO,
  TestVeExternalVesterImplementationV1,
  VeFeeCalculator,
  VoterAlwaysActive,
  VoterAlwaysActive__factory,
  VotingEscrow
} from '../src/types';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from 'packages/base/test/utils/setup';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  createDOLO,
  createExternalVesterDiscountCalculatorV1,
  createODOLO,
  createTestVeExternalVesterV1Proxy,
  createVeFeeCalculator,
  createVotingEscrow
} from './tokenomics-ecosystem-utils';
import { createContractWithAbi, withdrawFromDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { BigNumber, BigNumberish } from 'ethers';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from 'packages/base/test/utils/assertions';
import { getBlockTimestamp, increaseByTimeDelta, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createTestDiscountCalculator } from 'packages/liquidity-mining/test/liquidity-mining-ecosystem-utils';
import { convertToNearestWeek, expectEmptyExternalVesterPosition } from 'packages/liquidity-mining/test/liquidityMining-utils';

const defaultAccountNumber = ZERO_BI;
const ONE_WEEK = BigNumber.from('604800');
const TWO_YEARS = BigNumber.from(ONE_DAY_SECONDS).mul(365).mul(2);
const CLOSE_POSITION_WINDOW = ONE_WEEK;
const FORCE_CLOSE_POSITION_TAX = BigNumber.from('500');
const EMERGENCY_WITHDRAW_TAX = BigNumber.from('0');
const NO_MARKET_ID = MAX_UINT_256_BI;

const O_DOLO_AMOUNT = parseEther('1');
const REWARD_AMOUNT = O_DOLO_AMOUNT;
const PAIR_AMOUNT = parseEther('1');
const MAX_PAYMENT_AMOUNT = parseEther('10');
const TOTAL_REWARD_AMOUNT = parseEther('100');

const NFT_ID = ONE_BI;
const VE_TOKEN_ID = ONE_BI;
const PAYMENT_AMOUNT_BEFORE_DISCOUNT = parseEther('0.00025'); // 0.00025 ETH

const BUYBACK_POOL_ADDRESS = '0x1111111111111111111111111111111111111111';
const BASE_URI = 'oDolo Vesting Rulezzzz';
const NAME = 'oDolo Vesting';
const SYMBOL = 'voDOLO';

describe('Tokenomics', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let vester: TestVeExternalVesterImplementationV1;
  let discountCalculator: IVesterDiscountCalculator;
  let feeCalculator: VeFeeCalculator;
  let dolo: DOLO;
  let oDolo: ODOLO;
  let paymentMarketId: BigNumberish;
  let paymentToken: IERC20;
  let veDolo: VotingEscrow;
  let owner: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 219_404_000,
    });
    dolo = await createDOLO(core, core.gnosisSafe.address);
    owner = core.governance;
    await core.testEcosystem!.testPriceOracle.setPrice(dolo.address, parseEther('0.25'));
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
      oracleInfos: [
        {
          oracle: core.testEcosystem!.testPriceOracle.address,
          tokenPair: ADDRESS_ZERO,
          weight: 100
        },
      ],
      decimals: 18,
      token: dolo.address
    });
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('1000'));
    await setPriceOracle(core.tokens.weth, core.marketIds.weth, core.testEcosystem!.testPriceOracle);

    paymentToken = core.tokens.weth;
    paymentMarketId = core.marketIds.weth;
    await disableInterestAccrual(core, core.marketIds.weth);

    const voter = await createContractWithAbi<VoterAlwaysActive>(
      VoterAlwaysActive__factory.abi,
      VoterAlwaysActive__factory.bytecode,
      []
    );
    oDolo = await createODOLO(core);
    feeCalculator = await createVeFeeCalculator(core);

    veDolo = await createVotingEscrow(
      core,
      dolo,
      voter.address,
      feeCalculator,
      ADDRESS_ZERO,
      BUYBACK_POOL_ADDRESS
    );
    discountCalculator = await createExternalVesterDiscountCalculatorV1(veDolo);
    vester = await createTestVeExternalVesterV1Proxy(
      core,
      dolo,
      MAX_UINT_256_BI,
      paymentToken,
      paymentMarketId,
      dolo,
      MAX_UINT_256_BI,
      discountCalculator,
      oDolo,
      BASE_URI,
      NAME,
      SYMBOL
    );
    // @follow-up Order gets weird here
    await veDolo.connect(core.governance).setVester(vester.address);
    await vester.lazyInitialize(veDolo.address);
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

    await oDolo.connect(owner).ownerSetHandler(owner.address, true);
    await oDolo.connect(owner).ownerSetHandler(vester.address, true);
    await oDolo.connect(owner).mint(O_DOLO_AMOUNT.mul(2));
    await oDolo.connect(owner).transfer(core.hhUser1.address, O_DOLO_AMOUNT);
    await oDolo.connect(owner).transfer(core.hhUser2.address, O_DOLO_AMOUNT);
    await expectWalletBalance(core.hhUser1.address, oDolo, O_DOLO_AMOUNT);
    await expectWalletBalance(core.hhUser2.address, oDolo, O_DOLO_AMOUNT);

    // Pair token
    await dolo.connect(core.gnosisSafe).transfer(core.hhUser1.address, PAIR_AMOUNT.mul(2));

    // Payment token
    await setupWETHBalance(core, core.hhUser1, MAX_PAYMENT_AMOUNT, vester);
    await setupWETHBalance(core, core.hhUser2, MAX_PAYMENT_AMOUNT, vester);

    // Reward token
    await dolo.connect(core.gnosisSafe).transfer(owner.address, TOTAL_REWARD_AMOUNT);
    await dolo.connect(owner).approve(vester.address, TOTAL_REWARD_AMOUNT);
    await vester.connect(owner).ownerDepositRewardToken(TOTAL_REWARD_AMOUNT);

    await expectWalletBalance(owner, oDolo, ZERO_BI);
    await expectWalletBalance(owner, dolo, ZERO_BI);
    await expectWalletBalance(owner, paymentToken, ZERO_BI);

    await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, ZERO_BI);

    await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT);
    await expectWalletBalance(vester, paymentToken, ZERO_BI);

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
      expect(await vester.PAIR_TOKEN()).to.eq(dolo.address);
      expect(await vester.REWARD_TOKEN()).to.eq(dolo.address);
      expect(await vester.PAYMENT_MARKET_ID()).to.eq(paymentMarketId);
      expect(await vester.PAIR_MARKET_ID()).to.eq(MAX_UINT_256_BI);
      expect(await vester.REWARD_MARKET_ID()).to.eq(MAX_UINT_256_BI);
      expect(await vester.VE_TOKEN()).to.eq(veDolo.address);

      expect(await vester.discountCalculator()).to.eq(discountCalculator.address);
      expect(await vester.oToken()).to.eq(oDolo.address);
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
      const bytes = ethers.utils.defaultAbiCoder.encode(['address', 'string'], [ADDRESS_ZERO, 'hello there']);
      await expectThrow(vester.connect(owner).initialize(bytes), 'Initializable: contract is already initialized');
    });
  });

  describe('#vest', () => {
    it('should work with 1 week duration', async () => {
      await setupAllowancesForVesting();
      const result = await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await expectEvent(vester, result, 'VestingStarted', {
        owner: core.hhUser1.address,
        duration: ONE_WEEK,
        oDoloAmount: O_DOLO_AMOUNT,
        pairAmount: PAIR_AMOUNT,
        vestingId: NFT_ID,
      });

      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, dolo, PAIR_AMOUNT);

      expect(await vester.ownerOf(NFT_ID)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oDolo, O_DOLO_AMOUNT);
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT.add(PAIR_AMOUNT));
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(PAIR_AMOUNT);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_DOLO_AMOUNT));

      const position = await vester.vestingPositions(NFT_ID);
      expect(position.creator).to.eq(core.hhUser1.address);
      expect(position.id).to.eq(NFT_ID);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK);
      expect(position.oTokenAmount).to.eq(O_DOLO_AMOUNT);
      expect(position.pairAmount).to.eq(PAIR_AMOUNT);
    });

    it('should fail if PAIR_TOKEN exceeds max', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).vest(ONE_WEEK, O_DOLO_AMOUNT, ONE_BI),
        'VeExternalVesterImplementationV1: Pair amount exceeds max',
      );
    });

    it('should fail if vester has insufficient REWARD_TOKEN', async () => {
      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false);
      await expectThrow(
        vester.connect(core.hhUser1).vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'VeExternalVesterImplementationV1: Not enough rewards available',
      );
    });

    it('should fail if duration is different than 1 weeks', async () => {
      await expectThrow(
        vester.vest(ZERO_BI, O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
      await expectThrow(
        vester.vest(ONE_WEEK.sub(1), O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
      await expectThrow(
        vester.vest(ONE_WEEK.add(1), O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if vesting is not active', async () => {
      await vester.connect(owner).ownerSetIsVestingActive(false);
      await expectThrow(
        vester.vest(ONE_WEEK.mul(2).add(1), O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'VeExternalVesterImplementationV1: Vesting not active',
      );
    });

    it('should fail if reentered', async () => {
      await setupAllowancesForVesting();
      await expectThrow(
        vester.connect(core.hhUser1).callVestAndTriggerReentrancy(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally for existing veNFTId', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await increase(ONE_WEEK);

      await dolo.connect(core.gnosisSafe).transfer(core.hhUser1.address, 1);
      await dolo.connect(core.hhUser1).approve(veDolo.address, 1);
      await veDolo.create_lock(1, TWO_YEARS);
      await veDolo.approve(vester.address, 1);

      const paymentAmount = PAYMENT_AMOUNT_BEFORE_DISCOUNT.mul(5_000).div(10_000);
      const result = await vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ZERO_BI, MAX_PAYMENT_AMOUNT);
      const veNft = await veDolo.locked(VE_TOKEN_ID);
      expect(veNft.amount).to.eq(O_DOLO_AMOUNT.add(1));

      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        amountPaid: paymentAmount,
      });
      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(vester.address, oDolo, ZERO_BI);

      await expectWalletBalance(core.hhUser1, dolo, PAIR_AMOUNT.mul(2));
      await expectWalletBalance(core.hhUser1, paymentToken, MAX_PAYMENT_AMOUNT.sub(paymentAmount));
      await expectWalletBalance(veDolo, dolo, REWARD_AMOUNT.add(1));

      // Account for the pair amount being returned PLUS the REWARD_AMOUNT
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, paymentAmount);
      await expectProtocolBalance(core, owner, ZERO_BI, paymentMarketId, paymentAmount);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');

      await increase(TWO_YEARS);
      await expect(() => veDolo.connect(core.hhUser1).withdraw(VE_TOKEN_ID))
        .to.changeTokenBalance(dolo, core.hhUser1, O_DOLO_AMOUNT.add(1));
    });

    it('should work normally when creating new veNFTId', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await increase(ONE_WEEK);

      const paymentAmount = PAYMENT_AMOUNT_BEFORE_DISCOUNT.mul(5_000).div(10_000);

      const timestamp = BigNumber.from(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      const result = await vester.closePositionAndBuyTokens(
        NFT_ID,
        MAX_UINT_256_BI,
        convertToNearestWeek(timestamp, TWO_YEARS),
        MAX_PAYMENT_AMOUNT
      );
      const veNft = await veDolo.locked(VE_TOKEN_ID);
      expect(veNft.amount).to.eq(O_DOLO_AMOUNT);

      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        amountPaid: paymentAmount,
      });
      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(vester.address, oDolo, ZERO_BI);

      await expectWalletBalance(core.hhUser1, dolo, PAIR_AMOUNT.mul(2));
      await expectWalletBalance(core.hhUser1, paymentToken, MAX_PAYMENT_AMOUNT.sub(paymentAmount));
      await expectWalletBalance(veDolo, dolo, REWARD_AMOUNT);

      // Account for the pair amount being returned PLUS the REWARD_AMOUNT
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      await expectProtocolBalance(core, owner, defaultAccountNumber, paymentMarketId, paymentAmount);
      await expectProtocolBalance(core, owner, ZERO_BI, paymentMarketId, paymentAmount);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(REWARD_AMOUNT));

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');

      await increase(TWO_YEARS);
      await expect(() => veDolo.connect(core.hhUser1).withdraw(VE_TOKEN_ID))
        .to.changeTokenBalance(dolo, core.hhUser1, O_DOLO_AMOUNT);
    });

    it('should fail if veNft is already unlocked', async () => {
      await dolo.connect(core.gnosisSafe).transfer(core.hhUser1.address, 1);
      await dolo.connect(core.hhUser1).approve(veDolo.address, 1);
      await veDolo.create_lock(1, ONE_WEEK);

      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await increase(ONE_WEEK);

      await expectThrow(
        vester.closePositionAndBuyTokens(
          NFT_ID,
          VE_TOKEN_ID,
          ZERO_BI,
          MAX_PAYMENT_AMOUNT
        ),
      'ExternalVeDiscountCalculatorV1: Invalid veLockEndTime'
      );
    });

    it('should fail if the discount is invalid', async () => {
      await setupAllowancesForVesting();
      const time = ONE_WEEK;
      await vester.vest(time, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await increase(time);

      const paymentAmount = ZERO_BI;

      const tester = await createTestDiscountCalculator();
      await vester.connect(owner).ownerSetDiscountCalculator(tester.address);
      await tester.setDiscount(ONE_ETH_BI.add(1));

      await expectThrow(
        vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ZERO_BI, paymentAmount),
        `VeExternalVesterImplementationV1: Invalid discount <${ONE_ETH_BI.add(1).toString()}>`,
      );
    });

    it('should fail if cost is too high for max payment', async () => {
      await dolo.connect(core.gnosisSafe).transfer(core.hhUser1.address, 1);
      await dolo.connect(core.hhUser1).approve(veDolo.address, 1);
      await veDolo.create_lock(1, 365 * ONE_DAY_SECONDS);
      await setupAllowancesForVesting();

      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ZERO_BI, ONE_BI),
        'VeExternalVesterImplementationV1: Cost exceeds max payment amount',
      );
    });

    it('should fail if not called by position owner', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser2).closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ZERO_BI, MAX_PAYMENT_AMOUNT),
        'VeExternalVesterImplementationV1: Invalid position owner',
      );
    });

    it('should fail if before vesting time', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser1).closePositionAndBuyTokens(NFT_ID, VE_TOKEN_ID, ZERO_BI, MAX_PAYMENT_AMOUNT),
        'VeExternalVesterImplementationV1: Position not vested',
      );
    });

    it('should fail if reentered', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await expectThrow(
        vester
          .connect(core.hhUser1)
          .callClosePositionAndBuyTokensAndTriggerReentrancy(NFT_ID, VE_TOKEN_ID, ZERO_BI, MAX_UINT_256_BI),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#forceClosePosition', () => {
    it('should work normally', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(CLOSE_POSITION_WINDOW.add(ONE_WEEK).add(1));

      const result = await vester.connect(core.hhUser5).forceClosePosition(NFT_ID);
      const taxAmount = PAIR_AMOUNT.mul(5).div(100);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: taxAmount,
      });

      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(
        core.hhUser1,
        dolo,
        PAIR_AMOUNT.add(PAIR_AMOUNT).sub(taxAmount),
      );

      await expectWalletBalance(owner.address, dolo, PAIR_AMOUNT.mul(5).div(100));

      await expectWalletBalance(vester, oDolo, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should work normally if tax is zero', async () => {
      await setupAllowancesForVesting();
      await vester.connect(owner).ownerSetForceClosePositionTax(ZERO_BI);
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(CLOSE_POSITION_WINDOW.add(ONE_WEEK).add(1));

      const result = await vester.connect(core.hhUser5).forceClosePosition(NFT_ID);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: ZERO_BI,
      });

      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(core.hhUser1, dolo, PAIR_AMOUNT.add(PAIR_AMOUNT));

      await expectWalletBalance(owner.address, dolo, ZERO_BI);

      await expectWalletBalance(vester, oDolo, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should fail if position is not expirable', async () => {
      await vester.connect(owner).ownerSetClosePositionWindow(ZERO_BI);
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(NFT_ID),
        'VeExternalVesterImplementationV1: Positions are not expirable',
      );
    });

    it('should fail if position is not expired', async () => {
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
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
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(ONE_DAY_SECONDS);

      const result = await vester.connect(core.hhUser1).emergencyWithdraw(NFT_ID);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: ZERO_BI,
      });

      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(
        core.hhUser1,
        dolo,
        PAIR_AMOUNT.mul(2),
      );

      await expectWalletBalance(owner.address, dolo, ZERO_BI);

      await expectWalletBalance(vester, oDolo, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should work normally with tax', async () => {
      await vester.connect(owner).ownerSetEmergencyWithdrawTax(500); // 5%
      await setupAllowancesForVesting();
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      const vesterAccountNumber = getVesterAccountNumber(core.hhUser1, NFT_ID);
      await increase(ONE_DAY_SECONDS);

      const result = await vester.connect(core.hhUser1).emergencyWithdraw(NFT_ID);
      const taxAmount = PAIR_AMOUNT.mul(5).div(100);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        id: NFT_ID,
        pairTax: taxAmount,
      });

      await expectWalletBalance(core.hhUser1.address, oDolo, ZERO_BI);
      await expectWalletBalance(core.hhUser1, dolo, PAIR_AMOUNT.add(PAIR_AMOUNT).sub(taxAmount));

      await expectWalletBalance(owner.address, dolo, PAIR_AMOUNT.mul(5).div(100));

      await expectWalletBalance(vester, oDolo, ZERO_BI);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      expectEmptyExternalVesterPosition(await vester.vestingPositions(NFT_ID));
      await expectThrow(vester.ownerOf(NFT_ID), 'ERC721: invalid token ID');
    });

    it('should fail if not called by position owner', async () => {
      await expectThrow(vester.emergencyWithdraw(NFT_ID), 'ERC721: invalid token ID');

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
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
      await dolo.connect(core.gnosisSafe).transfer(owner.address, REWARD_AMOUNT);
      await dolo.connect(owner).approve(vester.address, REWARD_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);

      await vester.connect(owner).ownerDepositRewardToken(REWARD_AMOUNT);
      await increaseByTimeDelta(ONE_DAY_SECONDS);

      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.add(REWARD_AMOUNT));
      await expectWalletBalance(owner, dolo, ZERO_BI);
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT.add(REWARD_AMOUNT));
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

      await expectWalletBalance(owner.address, dolo, TOTAL_REWARD_AMOUNT);
      expect(await vester.pushedTokens()).to.eq(ZERO_BI);
      await expectWalletBalance(vester, dolo, ZERO_BI);

      await expectWalletBalance(owner.address, dolo, TOTAL_REWARD_AMOUNT);
    });

    it('should work normally when bypasses available amount', async () => {
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT);
      await expectWalletBalance(core.hhUser3, dolo, ZERO_BI);
      await expectWalletBalance(vester, dolo, TOTAL_REWARD_AMOUNT);

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(ONE_WEEK, O_DOLO_AMOUNT, PAIR_AMOUNT);
      await vester.connect(owner).ownerWithdrawRewardToken(core.hhUser3.address, O_DOLO_AMOUNT.mul(3), false);
      expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_DOLO_AMOUNT.mul(3)));
      await expectWalletBalance(core.hhUser3, dolo, O_DOLO_AMOUNT.mul(3));
    });

    it('should fail if attempting to withdraw more than available tokens', async () => {
      await expectThrow(
        vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT.mul(10), false),
        'VeExternalVesterImplementationV1: Insufficient available tokens',
      );

      await setupAllowancesForVesting();
      await vester.connect(core.hhUser1).vest(ONE_WEEK, O_DOLO_AMOUNT, PAIR_AMOUNT);
      expect(await vester.availableTokens()).to.eq(TOTAL_REWARD_AMOUNT.sub(O_DOLO_AMOUNT));
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
      // TODO: fix this since reward token has no market ID?
      // await increaseByTimeDelta(ONE_DAY_SECONDS);
      // await expectWalletBalance(owner.address, dolo, ZERO_BI);
      // expect(await vester.pushedTokens()).to.eq(TOTAL_REWARD_AMOUNT);
      //
      // await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false);
      // await vester.connect(owner).ownerAccrueRewardTokenInterest(core.hhUser3.address);
      //
      // await expectProtocolBalance(core, vester, defaultAccountNumber, rewardMarketId, ZERO_BI);
      // await expectWalletBalance(owner.address, dolo, TOTAL_REWARD_AMOUNT);
      // expect(await vester.pushedTokens()).to.eq(ZERO_BI);
      // await expectWalletBalanceIsBetween(
      //   core.hhUser3.address,
      //   dolo,
      //   TOTAL_REWARD_AMOUNT.mul(2).div(10_000),
      //   TOTAL_REWARD_AMOUNT.mul(3).div(10_000),
      // );
    });

    it('should fail if attempting to withdraw all before the pushed tokens are cleared', async () => {
      await expectThrow(
        vester.connect(owner).ownerAccrueRewardTokenInterest(owner.address),
        `VeExternalVesterImplementationV1: Interest cannot be withdrawn yet <${TOTAL_REWARD_AMOUNT}>`,
      );
    });

    it('should fail if reward token does not have a market ID', async () => {
      await vester.connect(owner).ownerWithdrawRewardToken(owner.address, TOTAL_REWARD_AMOUNT, false);
      await expectThrow(
        vester.connect(owner).ownerAccrueRewardTokenInterest(owner.address),
        'VeExternalVesterImplementationV1: Reward token has no interest',
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
      await vester.vest(ONE_WEEK, O_DOLO_AMOUNT, O_DOLO_AMOUNT);
      expect(await vester.tokenURI(1)).to.eq('hello');
    });

    it('should fail if tokenId is not minted', async () => {
      await expectThrow(vester.tokenURI(1), 'ERC721: invalid token ID');
    });
  });

  async function setupAllowancesForVesting() {
    await oDolo.connect(core.hhUser1).approve(vester.address, O_DOLO_AMOUNT);
    await dolo.connect(core.hhUser1).approve(vester.address, O_DOLO_AMOUNT);
    await paymentToken.connect(core.hhUser1).approve(vester.address, MAX_PAYMENT_AMOUNT);
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
