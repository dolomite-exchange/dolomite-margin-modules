import {
  MAX_UINT_256_BI,
  Network,
  ONE_DAY_SECONDS,
  ONE_WEEK_SECONDS,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { TestExternalVesterDiscountCalculatorV1, TestVeToken } from '../src/types';
import { createTestExternalVesterDiscountCalculatorV1, createTestVeToken } from './liquidity-mining-ecosystem-utils';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';

const NFT_ID = 0;
const EXTRA_BYTES = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, 0]);
const TIMESTAMP = 2_000_000_000; // using timestamp for ease of testing
const TWO_YEARS_SECONDS = ONE_DAY_SECONDS * 365 * 2;

describe('ExternalVesterDiscountCalculatorV1', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let veToken: TestVeToken;
  let calculator: TestExternalVesterDiscountCalculatorV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    veToken = await createTestVeToken(core.tokens.weth);
    calculator = await createTestExternalVesterDiscountCalculatorV1(veToken);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#calculateDiscount', () => {
    it('should work when veNft is locked for half a week', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_DAY_SECONDS * 3.5);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.025'));
    });

    it('should work when veNft is locked for one week', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_WEEK_SECONDS);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.05'));
    });

    it('should work when veNft is locked for one year + 3.5 days (halfway through linear decay)', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_DAY_SECONDS * 365 + ONE_DAY_SECONDS * 3.5);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.2750'));
    });

    it('should work when veNft is locked for 1 second less than 103 weeks', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_WEEK_SECONDS * 103 - 1);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.be.lt(parseEther('.5'));
    });

    it('should work when veNft is locked for 103 weeks or greater', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_WEEK_SECONDS * 103);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.5'));

      await veToken.setAmountAndEnd(10_000, TIMESTAMP + ONE_WEEK_SECONDS * 103 + 1);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.5'));
    });

    it('should work when veNft is locked for two years', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP + TWO_YEARS_SECONDS);
      await increaseTo(TIMESTAMP);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES)).to.eq(parseEther('.5'));
    });

    it('should fail when veNft is not locked', async () => {
      await veToken.setAmountAndEnd(10_000, TIMESTAMP);
      await increaseTo(TIMESTAMP);
      await expectThrow(
        calculator.calculateDiscount(NFT_ID, ZERO_BI, EXTRA_BYTES),
        'ExternalVeDiscountCalculatorV1: veNft is not locked'
      );
    });

    it('should use the given duration when veNftId is max uint256', async () => {
      await increaseTo(TIMESTAMP);
      const bytes = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [MAX_UINT_256_BI, TWO_YEARS_SECONDS]);
      expect(await calculator.calculateDiscount(NFT_ID, ZERO_BI, bytes)).to.eq(parseEther('.5'));
    });

    it('should return endValue if past linear duration (can only happen in test contract)', async () => {
      expect(await calculator.testLinearDecayMax(0, 100, 0, 100)).to.eq(100);
    });
  });
});
