import { BigNumber } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { TestDecimalLib, TestDecimalLib__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';

const BASE = '1000000000000000000';

describe('DecimalLib', () => {
  let snapshotId: string;

  let testDecimalLib: TestDecimalLib;

  before(async () => {
    testDecimalLib = await createContractWithAbi<TestDecimalLib>(
      TestDecimalLib__factory.abi,
      TestDecimalLib__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('one', () => {
    it('should work', async () => {
      const result = await testDecimalLib.DecimalLibOne();
      expect(result.value.toString()).to.eql('1000000000000000000');
    });
  });

  describe('onePlus', () => {
    it('should work', async () => {
      const result = await testDecimalLib.DecimalLibOnePlus({ value: '50000000000000000' });
      expect(result.value.toString()).to.eql('1050000000000000000');
    });
  });

  describe('mul', () => {
    const BN_DOWN = BigNumber.clone({ ROUNDING_MODE: 1 });
    const tests = [
      ['10000', BASE],
      ['20000', '0'],
      ['0', new BN_DOWN(3).times(BASE).toFixed()],
      ['20000', new BN_DOWN(3).times(BASE).toFixed()],
      ['12410000', new BN_DOWN(249835).times(BASE).toFixed()],
      ['12890000', new BN_DOWN(12431).times(BASE).toFixed()],
      ['10000', new BN_DOWN(12341).times(BASE).toFixed()],
      ['120000', BASE],
      ['0', '0'],
      ['10000', BASE],
      ['9980000', new BN_DOWN(2).times(BASE).toFixed()],
      ['400000', new BN_DOWN(50).times(BASE).toFixed()],
    ];

    it('should work for tests', async () => {
      const results = await Promise.all(
        tests.map(args => testDecimalLib.DecimalLibMul(args[0], { value: args[1] }))
          .map(p => p.then(r => r.toString())),
      );
      expect(results).to.eql(
        tests.map(args => new BN_DOWN(args[0])
          .times(args[1])
          .div(BASE)
          .toFixed(0)),
      );
    });
  });

  describe('div', () => {
    const BN_DOWN = BigNumber.clone({ ROUNDING_MODE: 1 });
    const tests = [
      ['10000', BASE],
      ['0', new BN_DOWN(3).times(BASE).toFixed()],
      ['20000', new BN_DOWN(3).times(BASE).toFixed()],
      ['12410000', new BN_DOWN(249835).times(BASE).toFixed()],
      ['12890000', new BN_DOWN(12431).times(BASE).toFixed()],
      ['10000', new BN_DOWN(12341).times(BASE).toFixed()],
      ['120000', BASE],
      ['10000', BASE],
      ['9980000', new BN_DOWN(2).times(BASE).toFixed()],
      ['400000', new BN_DOWN(50).times(BASE).toFixed()],
    ];

    it('should work for tests', async () => {
      const results = await Promise.all(
        tests.map(args => testDecimalLib.DecimalLibDiv(args[0], { value: args[1] }))
          .map(p => p.then(r => r.toString())),
      );
      expect(results).to.eql(
        tests.map(args => new BN_DOWN(args[0])
          .times(BASE)
          .div(args[1])
          .toFixed(0)),
      );
    });
  });
});
