import { BigNumber, INTEGERS } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { TestDolomiteMarginMath, TestDolomiteMarginMath__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectThrow } from '../../../packages/base/test/utils/assertions';

describe('DolomiteMarginMath', () => {
  let snapshotId: string;

  let testDolomiteMarginMath: TestDolomiteMarginMath;

  before(async () => {
    testDolomiteMarginMath = await createContractWithAbi<TestDolomiteMarginMath>(
      TestDolomiteMarginMath__factory.abi,
      TestDolomiteMarginMath__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Math', () => {
    const BN_DOWN = BigNumber.clone({ ROUNDING_MODE: 1 });
    const BN_UP = BigNumber.clone({ ROUNDING_MODE: 0 });
    const BN_HALF_UP = BigNumber.clone({ ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    const largeNumber = INTEGERS.ONES_255.div('1.5').toFixed(0);
    const tests = [
      [1, 1, 1],
      [2, 0, 3],
      [0, 3, 2],
      [2, 3, 4],
      [1241, 249835, 89234],
      [1289, 12431, 1],
      [1, 12341, 98],
      [12, 1, 878978],
      [0, 0, 1],
      [1, 1, 999],
      [998, 2, 999],
      [40, 50, 21],
    ];

    it('getPartial', async () => {
      const results = await Promise.all(
        tests.map(args => testDolomiteMarginMath.DolomiteMarginMathGetPartial(args[0], args[1], args[2]))
          .map(p => p.then(r => r.toString())),
      );
      expect(results).to.eql(
        tests.map(args => new BN_DOWN(args[0])
          .times(args[1])
          .div(args[2])
          .toFixed(0)),
      );
    });

    it('getPartial reverts', async () => {
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathGetPartial(1, 1, 0));
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathGetPartial(largeNumber, largeNumber, 1));
    });

    it('getPartialRoundUp', async () => {
      const results = await Promise.all(
        tests.map(args => testDolomiteMarginMath.DolomiteMarginMathGetPartialRoundUp(args[0], args[1], args[2]))
          .map(p => p.then(r => r.toString())),
      );
      expect(results).to.eql(
        tests.map(args => new BN_UP(args[0])
          .times(args[1])
          .div(args[2])
          .toFixed(0)),
      );
    });

    it('getPartialRoundHalfUp', async () => {
      const results = await Promise.all(
        tests.map(args => testDolomiteMarginMath.DolomiteMarginMathGetPartialRoundHalfUp(args[0], args[1], args[2]))
          .map(p => p.then(r => r.toString())),
      );
      expect(results).to.eql(
        tests.map(args => new BN_HALF_UP(args[0])
          .times(args[1])
          .div(args[2])
          .toFixed(0)),
      );
    });

    it('getPartialRoundHalfUp reverts', async () => {
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathGetPartialRoundHalfUp(1, 1, 0));
      await expectThrow(
        testDolomiteMarginMath.DolomiteMarginMathGetPartialRoundHalfUp(largeNumber, largeNumber, 1),
      );
    });

    it('to128', async () => {
      const large = '340282366920938463463374607431768211456'; // 2^128
      const small = '340282366920938463463374607431768211455'; // 2^128 - 1
      const result = await testDolomiteMarginMath.DolomiteMarginMathTo128(small);
      expect(result).to.eq(small);
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathTo128(large));
    });

    it('to96', async () => {
      const large = '79228162514264337593543950336'; // 2^96
      const small = '79228162514264337593543950335'; // 2^96 - 1
      const result = await testDolomiteMarginMath.DolomiteMarginMathTo96(small);
      expect(result).to.eq(small);
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathTo96(large));
    });

    it('to32', async () => {
      const large = 4294967296; // 2^32
      const small = 4294967295; // 2^32 - 1
      const result = await testDolomiteMarginMath.DolomiteMarginMathTo32(small);
      expect(result).to.eq(small);
      await expectThrow(testDolomiteMarginMath.DolomiteMarginMathTo32(large));
    });
  });
});
