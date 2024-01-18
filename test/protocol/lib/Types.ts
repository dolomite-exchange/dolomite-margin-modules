import { expect } from 'chai';
import { TestTypes, TestTypes__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';

function parse(value: any) {
  return { sign: value[0], value: value[1].toString() };
}

describe('Types', () => {
  let snapshotId: string;

  let testTypes: TestTypes;

  before(async () => {
    testTypes = await createContractWithAbi<TestTypes>(
      TestTypes__factory.abi,
      TestTypes__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Types', () => {
    const lo = '10';
    const hi = '20';
    const zero = '0';
    const negZo = { sign: false, value: zero };
    const posZo = { sign: true, value: zero };
    const negLo = { sign: false, value: lo };
    const posLo = { sign: true, value: lo };
    const negHi = { sign: false, value: hi };
    const posHi = { sign: true, value: hi };

    it('zeroPar', async () => {
      const result = await testTypes.TypesZeroPar();
      expect(result.sign).to.eql(false);
      expect(result.value).to.eq(zero);
    });

    it('parSub', async () => {
      let results: any[];
      // sub zero
      results = await Promise.all([
        testTypes.TypesParSub(posLo, posZo),
        testTypes.TypesParSub(posLo, negZo),
        testTypes.TypesParSub(posZo, posZo),
        testTypes.TypesParSub(posZo, negZo),
        testTypes.TypesParSub(negZo, posZo),
        testTypes.TypesParSub(negZo, negZo),
        testTypes.TypesParSub(negLo, posZo),
        testTypes.TypesParSub(negLo, negZo),
      ]);
      expect(results.map(parse)).to.eql([posLo, posLo, posZo, posZo, negZo, negZo, negLo, negLo]);

      // sub positive
      results = await Promise.all([
        testTypes.TypesParSub(posLo, posHi),
        testTypes.TypesParSub(posLo, posLo),
        testTypes.TypesParSub(posZo, posLo),
        testTypes.TypesParSub(negZo, posLo),
        testTypes.TypesParSub(posHi, posLo),
        testTypes.TypesParSub(negLo, posLo),
      ]);
      expect(results.map(parse)).to.eql([negLo, posZo, negLo, negLo, posLo, negHi]);

      // sub negative
      results = await Promise.all([
        testTypes.TypesParSub(negLo, negHi),
        testTypes.TypesParSub(negLo, negLo),
        testTypes.TypesParSub(negZo, negLo),
        testTypes.TypesParSub(posZo, negLo),
        testTypes.TypesParSub(negHi, negLo),
        testTypes.TypesParSub(posLo, negLo),
      ]);
      expect(results.map(parse)).to.eql([posLo, negZo, posLo, posLo, negLo, posHi]);
    });

    it('parAdd', async () => {
      let results: any[];
      // add zero
      results = await Promise.all([
        testTypes.TypesParAdd(posLo, posZo),
        testTypes.TypesParAdd(posLo, negZo),
        testTypes.TypesParAdd(posZo, posZo),
        testTypes.TypesParAdd(posZo, negZo),
        testTypes.TypesParAdd(negZo, posZo),
        testTypes.TypesParAdd(negZo, negZo),
        testTypes.TypesParAdd(negLo, posZo),
        testTypes.TypesParAdd(negLo, negZo),
      ]);
      expect(results.map(parse)).to.eql([posLo, posLo, posZo, posZo, negZo, negZo, negLo, negLo]);

      // add positive
      results = await Promise.all([
        testTypes.TypesParAdd(negLo, posHi),
        testTypes.TypesParAdd(negLo, posLo),
        testTypes.TypesParAdd(negZo, posLo),
        testTypes.TypesParAdd(posZo, posLo),
        testTypes.TypesParAdd(negHi, posLo),
        testTypes.TypesParAdd(posLo, posLo),
      ]);
      expect(results.map(parse)).to.eql([posLo, negZo, posLo, posLo, negLo, posHi]);

      // add negative
      results = await Promise.all([
        testTypes.TypesParAdd(posLo, negHi),
        testTypes.TypesParAdd(posLo, negLo),
        testTypes.TypesParAdd(posZo, negLo),
        testTypes.TypesParAdd(negZo, negLo),
        testTypes.TypesParAdd(posHi, negLo),
        testTypes.TypesParAdd(negLo, negLo),
      ]);
      expect(results.map(parse)).to.eql([negLo, posZo, negLo, negLo, posLo, negHi]);
    });

    it('parEquals', async () => {
      const trues = await Promise.all([
        testTypes.TypesParEquals(posHi, posHi),
        testTypes.TypesParEquals(posLo, posLo),
        testTypes.TypesParEquals(posZo, posZo),
        testTypes.TypesParEquals(posZo, negZo),
        testTypes.TypesParEquals(negZo, negZo),
        testTypes.TypesParEquals(negLo, negLo),
        testTypes.TypesParEquals(negHi, negHi),
      ]);
      expect(trues).to.eql([true, true, true, true, true, true, true]);
      const falses = await Promise.all([
        testTypes.TypesParEquals(posHi, posLo),
        testTypes.TypesParEquals(posLo, negLo),
        testTypes.TypesParEquals(posHi, negHi),
        testTypes.TypesParEquals(posZo, negHi),
        testTypes.TypesParEquals(negHi, negLo),
        testTypes.TypesParEquals(negLo, posLo),
        testTypes.TypesParEquals(negLo, posHi),
      ]);
      expect(falses).to.eql([false, false, false, false, false, false, false]);
    });

    it('parNegative', async () => {
      const results = await Promise.all([
        testTypes.TypesParNegative(posHi),
        testTypes.TypesParNegative(posLo),
        testTypes.TypesParNegative(posZo),
        testTypes.TypesParNegative(negZo),
        testTypes.TypesParNegative(negLo),
        testTypes.TypesParNegative(negHi),
      ]);
      expect(results.map(parse)).to.eql([negHi, negLo, negZo, posZo, posLo, posHi]);
    });

    it('parIsNegative', async () => {
      const results = await Promise.all([
        testTypes.TypesParIsNegative(posHi),
        testTypes.TypesParIsNegative(posLo),
        testTypes.TypesParIsNegative(posZo),
        testTypes.TypesParIsNegative(negZo),
        testTypes.TypesParIsNegative(negLo),
        testTypes.TypesParIsNegative(negHi),
      ]);
      expect(results).to.eql([false, false, false, false, true, true]);
    });

    it('parIsPositive', async () => {
      const results = await Promise.all([
        testTypes.TypesParIsPositive(posHi),
        testTypes.TypesParIsPositive(posLo),
        testTypes.TypesParIsPositive(posZo),
        testTypes.TypesParIsPositive(negZo),
        testTypes.TypesParIsPositive(negLo),
        testTypes.TypesParIsPositive(negHi),
      ]);
      expect(results).to.eql([true, true, false, false, false, false]);
    });

    it('parIsZero', async () => {
      const results = await Promise.all([
        testTypes.TypesParIsZero(posHi),
        testTypes.TypesParIsZero(posLo),
        testTypes.TypesParIsZero(posZo),
        testTypes.TypesParIsZero(negZo),
        testTypes.TypesParIsZero(negLo),
        testTypes.TypesParIsZero(negHi),
      ]);
      expect(results).to.eql([false, false, true, true, false, false]);
    });

    it('parIsLessThanZero', async () => {
      const results = await Promise.all([
        testTypes.TypesParIsLessThanZero(posHi),
        testTypes.TypesParIsLessThanZero(posLo),
        testTypes.TypesParIsLessThanZero(posZo),
        testTypes.TypesParIsLessThanZero(negZo),
        testTypes.TypesParIsLessThanZero(negLo),
        testTypes.TypesParIsLessThanZero(negHi),
      ]);
      expect(results).to.eql([false, false, false, false, true, true]);
    });

    it('parIsGreaterThanOrEqualToZero', async () => {
      const results = await Promise.all([
        testTypes.TypesParIsGreaterThanOrEqualToZero(posHi),
        testTypes.TypesParIsGreaterThanOrEqualToZero(posLo),
        testTypes.TypesParIsGreaterThanOrEqualToZero(posZo),
        testTypes.TypesParIsGreaterThanOrEqualToZero(negZo),
        testTypes.TypesParIsGreaterThanOrEqualToZero(negLo),
        testTypes.TypesParIsGreaterThanOrEqualToZero(negHi),
      ]);
      expect(results).to.eql([true, true, true, true, false, false]);
    });

    it('zeroWei', async () => {
      const result = await testTypes.TypesZeroWei();
      expect(result.sign).to.eql(false);
      expect(result.value.toString()).to.eql(zero);
    });

    it('weiSub', async () => {
      let results: any[];
      // sub zero
      results = await Promise.all([
        testTypes.TypesWeiSub(posLo, posZo),
        testTypes.TypesWeiSub(posLo, negZo),
        testTypes.TypesWeiSub(posZo, posZo),
        testTypes.TypesWeiSub(posZo, negZo),
        testTypes.TypesWeiSub(negZo, posZo),
        testTypes.TypesWeiSub(negZo, negZo),
        testTypes.TypesWeiSub(negLo, posZo),
        testTypes.TypesWeiSub(negLo, negZo),
      ]);
      expect(results.map(parse)).to.eql([posLo, posLo, posZo, posZo, negZo, negZo, negLo, negLo]);

      // sub positive
      results = await Promise.all([
        testTypes.TypesWeiSub(posLo, posHi),
        testTypes.TypesWeiSub(posLo, posLo),
        testTypes.TypesWeiSub(posZo, posLo),
        testTypes.TypesWeiSub(negZo, posLo),
        testTypes.TypesWeiSub(posHi, posLo),
        testTypes.TypesWeiSub(negLo, posLo),
      ]);
      expect(results.map(parse)).to.eql([negLo, posZo, negLo, negLo, posLo, negHi]);

      // sub negative
      results = await Promise.all([
        testTypes.TypesWeiSub(negLo, negHi),
        testTypes.TypesWeiSub(negLo, negLo),
        testTypes.TypesWeiSub(negZo, negLo),
        testTypes.TypesWeiSub(posZo, negLo),
        testTypes.TypesWeiSub(negHi, negLo),
        testTypes.TypesWeiSub(posLo, negLo),
      ]);
      expect(results.map(parse)).to.eql([posLo, negZo, posLo, posLo, negLo, posHi]);
    });

    it('weiAdd', async () => {
      let results: any[];
      // add zero
      results = await Promise.all([
        testTypes.TypesWeiAdd(posLo, posZo),
        testTypes.TypesWeiAdd(posLo, negZo),
        testTypes.TypesWeiAdd(posZo, posZo),
        testTypes.TypesWeiAdd(posZo, negZo),
        testTypes.TypesWeiAdd(negZo, posZo),
        testTypes.TypesWeiAdd(negZo, negZo),
        testTypes.TypesWeiAdd(negLo, posZo),
        testTypes.TypesWeiAdd(negLo, negZo),
      ]);
      expect(results.map(parse)).to.eql([posLo, posLo, posZo, posZo, negZo, negZo, negLo, negLo]);

      // add positive
      results = await Promise.all([
        testTypes.TypesWeiAdd(negLo, posHi),
        testTypes.TypesWeiAdd(negLo, posLo),
        testTypes.TypesWeiAdd(negZo, posLo),
        testTypes.TypesWeiAdd(posZo, posLo),
        testTypes.TypesWeiAdd(negHi, posLo),
        testTypes.TypesWeiAdd(posLo, posLo),
      ]);
      expect(results.map(parse)).to.eql([posLo, negZo, posLo, posLo, negLo, posHi]);

      // add negative
      results = await Promise.all([
        testTypes.TypesWeiAdd(posLo, negHi),
        testTypes.TypesWeiAdd(posLo, negLo),
        testTypes.TypesWeiAdd(posZo, negLo),
        testTypes.TypesWeiAdd(negZo, negLo),
        testTypes.TypesWeiAdd(posHi, negLo),
        testTypes.TypesWeiAdd(negLo, negLo),
      ]);
      expect(results.map(parse)).to.eql([negLo, posZo, negLo, negLo, posLo, negHi]);
    });

    it('weiEquals', async () => {
      const trues = await Promise.all([
        testTypes.TypesWeiEquals(posHi, posHi),
        testTypes.TypesWeiEquals(posLo, posLo),
        testTypes.TypesWeiEquals(posZo, posZo),
        testTypes.TypesWeiEquals(posZo, negZo),
        testTypes.TypesWeiEquals(negZo, negZo),
        testTypes.TypesWeiEquals(negLo, negLo),
        testTypes.TypesWeiEquals(negHi, negHi),
      ]);
      expect(trues).to.eql([true, true, true, true, true, true, true]);
      const falses = await Promise.all([
        testTypes.TypesWeiEquals(posHi, posLo),
        testTypes.TypesWeiEquals(posLo, negLo),
        testTypes.TypesWeiEquals(posHi, negHi),
        testTypes.TypesWeiEquals(posZo, negHi),
        testTypes.TypesWeiEquals(negHi, negLo),
        testTypes.TypesWeiEquals(negLo, posLo),
        testTypes.TypesWeiEquals(negLo, posHi),
      ]);
      expect(falses).to.eql([false, false, false, false, false, false, false]);
    });

    it('weiNegative', async () => {
      const results = await Promise.all([
        testTypes.TypesWeiNegative(posHi),
        testTypes.TypesWeiNegative(posLo),
        testTypes.TypesWeiNegative(posZo),
        testTypes.TypesWeiNegative(negZo),
        testTypes.TypesWeiNegative(negLo),
        testTypes.TypesWeiNegative(negHi),
      ]);
      expect(results.map(parse)).to.eql([negHi, negLo, negZo, posZo, posLo, posHi]);
    });

    it('weiIsNegative', async () => {
      const results = await Promise.all([
        testTypes.TypesWeiIsNegative(posHi),
        testTypes.TypesWeiIsNegative(posLo),
        testTypes.TypesWeiIsNegative(posZo),
        testTypes.TypesWeiIsNegative(negZo),
        testTypes.TypesWeiIsNegative(negLo),
        testTypes.TypesWeiIsNegative(negHi),
      ]);
      expect(results).to.eql([false, false, false, false, true, true]);
    });

    it('weiIsPositive', async () => {
      const results = await Promise.all([
        testTypes.TypesWeiIsPositive(posHi),
        testTypes.TypesWeiIsPositive(posLo),
        testTypes.TypesWeiIsPositive(posZo),
        testTypes.TypesWeiIsPositive(negZo),
        testTypes.TypesWeiIsPositive(negLo),
        testTypes.TypesWeiIsPositive(negHi),
      ]);
      expect(results).to.eql([true, true, false, false, false, false]);
    });

    it('weiIsZero', async () => {
      const results = await Promise.all([
        testTypes.TypesWeiIsZero(posHi),
        testTypes.TypesWeiIsZero(posLo),
        testTypes.TypesWeiIsZero(posZo),
        testTypes.TypesWeiIsZero(negZo),
        testTypes.TypesWeiIsZero(negLo),
        testTypes.TypesWeiIsZero(negHi),
      ]);
      expect(results).to.eql([false, false, true, true, false, false]);
    });
  });
});
