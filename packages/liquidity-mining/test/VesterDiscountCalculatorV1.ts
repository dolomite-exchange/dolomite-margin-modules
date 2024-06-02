import {
  Network,
  ONE_ETH_BI,
  ONE_WEEK_SECONDS,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { OARB, VesterDiscountCalculatorV1 } from '../src/types';
import { createOARB, createVesterDiscountCalculatorV1 } from './liquidity-mining-ecosystem-utils';

describe('VesterDiscountCalculatorV1', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let calculator: VesterDiscountCalculatorV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    calculator = await createVesterDiscountCalculatorV1();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#calculateDiscount', () => {
    it('should work when 0 is passed in', async () => {
      expect(await calculator.calculateDiscount(0)).to.eq(2_000);
    });

    it('should work when 1 week is passed in', async () => {
      expect(await calculator.calculateDiscount(ONE_WEEK_SECONDS)).to.eq(2_200);
    });

    it('should work when 3 weeks is passed in', async () => {
      expect(await calculator.calculateDiscount(ONE_WEEK_SECONDS * 3)).to.eq(2_600);
    });

    it('should work when 40 weeks is passed in', async () => {
      expect(await calculator.calculateDiscount(ONE_WEEK_SECONDS * 40)).to.eq(10_000);
    });
  });
});
