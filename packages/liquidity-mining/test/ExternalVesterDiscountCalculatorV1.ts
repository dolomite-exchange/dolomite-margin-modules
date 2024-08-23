import {
  MAX_UINT_256_BI,
  Network,
  ONE_DAY_SECONDS,
  ONE_WEEK_SECONDS,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { ExternalVesterDiscountCalculatorV1, TestVeToken } from '../src/types';
import { createExternalVesterDiscountCalculatorV1, createTestVeToken } from './liquidity-mining-ecosystem-utils';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { BigNumber, BigNumberish } from 'ethers';
import { convertToNearestWeek } from './liquidityMining-utils';

const NFT_ID = 0;
const EXTRA_BYTES = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, 0]);
const TIMESTAMP = 1814400000; // timestamp divisible by 1 week
const TWO_YEARS = BigNumber.from(ONE_DAY_SECONDS * 365 * 2);
const ONE_WEEK = BigNumber.from(ONE_WEEK_SECONDS);

describe('ExternalVesterDiscountCalculatorV1', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let veToken: TestVeToken;
  let calculator: ExternalVesterDiscountCalculatorV1;
  let timestamp: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 245_545_000,
    });
    veToken = await createTestVeToken(core.tokens.weth);
    calculator = await createExternalVesterDiscountCalculatorV1(veToken);
    await veToken.setAmountAndEnd(10_000, TIMESTAMP);
    timestamp = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#calculateDiscount', () => {
    it('should work when existing veNft has 1 week lock', async () => {
      await veToken.setAmountAndEnd(10_000, convertToNearestWeek(timestamp, ONE_WEEK.mul(2)));
      const nextWeek = convertToNearestWeek(timestamp, ONE_WEEK);
      await increaseTo(nextWeek);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.05'));
    });

    it('should work when veNft is created with 1 week lock', async () => {
      const nextWeek = convertToNearestWeek(timestamp, ONE_WEEK);
      await increaseTo(nextWeek);
      const bytes = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [MAX_UINT_256_BI, convertToNearestWeek(nextWeek, ONE_WEEK)]
      );
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, bytes)).to.eq(parseEther('.05'));
    });

    it('should work when existing veNft has 2 year lock', async () => {
      await veToken.setAmountAndEnd(10_000, convertToNearestWeek(timestamp, TWO_YEARS));
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.5'));
    });

    it('should work when veNft is created with 2 year lock', async () => {
      const bytes = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [MAX_UINT_256_BI, convertToNearestWeek(timestamp, TWO_YEARS)]
      );
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, bytes)).to.eq(parseEther('.5'));
    });

    it('should return properly at 52.5 weeks (half of 103 + 1 week)', async () => {
      await increaseTo(TIMESTAMP - ONE_WEEK_SECONDS * 52.5); // rounds up to nearest week so little greater than 27.5%
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.be.gt(parseEther('.2750'));
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.be.lt(parseEther('.28'));
    });

    it('should return properly at 26.75 weeks (103 / 4 + 1 week)', async () => {
      await increaseTo(TIMESTAMP - ONE_WEEK_SECONDS * 26.75); // rounds up to nearest week so little greater than 16.25%
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.be.gt(parseEther('.1625'));
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.be.lt(parseEther('.165'));
    });

    it('should return 5% at one week', async () => {
      await increaseTo(TIMESTAMP - ONE_WEEK_SECONDS);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.05'));
    });

    it('should return 2.5% at 3.5 days', async () => {
      await increaseTo(TIMESTAMP - ONE_DAY_SECONDS * 3.5);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.025'));
    });

    it('should fail when veNft is not locked', async () => {
      await increaseTo(TIMESTAMP);
      await expectThrow(
        calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES),
        'ExternalVeDiscountCalculatorV1: Invalid veLockEndTime'
      );
    });

    it('should fail if lock end time is not a multiple of 1 week', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + 1);
      await expectThrow(
        calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES),
        'ExternalVeDiscountCalculatorV1: Invalid veLockEndTime'
      );
    });
  });

  describe('#calculateLinearDiscount', () => {
    it('should return 50% if greater than 104 weeks', async () => {
      expect(await calculator.calculateLinearDiscount(TWO_YEARS)).to.eq(parseEther('.5'));
    });
  });

  describe('#calculateLinearDiscountWithinOneWeek', () => {
    it('should return 5% if greater than 1 week', async () => {
      expect(await calculator.calculateLinearDiscountWithinOneWeek(ONE_WEEK_SECONDS + 1)).to.eq(parseEther('.05'));
    });
  });
});
