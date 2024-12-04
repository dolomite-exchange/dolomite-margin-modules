import {
  BYTES_EMPTY,
  ONE_WEEK_SECONDS,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expect } from 'chai';
import { VesterDiscountCalculatorV1 } from '../src/types';
import { createVesterDiscountCalculatorV1 } from './liquidity-mining-ecosystem-utils';

const NFT_ID = 0;

describe('VesterDiscountCalculatorV1', () => {
  let snapshotId: string;
  let calculator: VesterDiscountCalculatorV1;

  before(async () => {
    calculator = await createVesterDiscountCalculatorV1();
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#calculateDiscount', () => {
    it('should work when 0 is passed in', async () => {
      expect(await calculator.calculateDiscount(NFT_ID, 0, BYTES_EMPTY)).to.eq(2_000);
    });

    it('should work when 1 week is passed in', async () => {
      expect(await calculator.calculateDiscount(NFT_ID, ONE_WEEK_SECONDS, BYTES_EMPTY)).to.eq(2_200);
    });

    it('should work when 3 weeks is passed in', async () => {
      expect(await calculator.calculateDiscount(NFT_ID, ONE_WEEK_SECONDS * 3, BYTES_EMPTY)).to.eq(2_600);
    });

    it('should work when 40 weeks is passed in', async () => {
      expect(await calculator.calculateDiscount(NFT_ID, ONE_WEEK_SECONDS * 40, BYTES_EMPTY)).to.eq(10_000);
    });
  });
});
