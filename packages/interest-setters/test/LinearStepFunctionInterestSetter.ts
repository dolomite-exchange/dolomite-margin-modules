import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { getLinearStepFunctionInterestSetterConstructorParams } from '../src/interest-setters-constructors';
import { LinearStepFunctionInterestSetter, LinearStepFunctionInterestSetter__factory } from '../src/types';

const zero = BigNumber.from(0);
const lowerRate = BigNumber.from('60000000000000000');
const upperRate = BigNumber.from('1000000000000000000');
const optimalRate = BigNumber.from('900000000000000000');
const maximumRate = lowerRate.add(upperRate); // 106%
const secondsPerYear = BigNumber.from(31_536_000);
describe('LinearStepFunctionInterestSetter', () => {
  let snapshotId: string;

  let interestSetter: LinearStepFunctionInterestSetter;

  before(async () => {
    interestSetter = await createContractWithAbi<LinearStepFunctionInterestSetter>(
      LinearStepFunctionInterestSetter__factory.abi,
      LinearStepFunctionInterestSetter__factory.bytecode,
      getLinearStepFunctionInterestSetterConstructorParams(lowerRate, upperRate, optimalRate),
    );
    expect(await interestSetter.interestSetterType()).to.eq(1); // linear

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should fail when rates are inverted', async () => {
      await expectThrow(
        createContractWithAbi<LinearStepFunctionInterestSetter>(
          LinearStepFunctionInterestSetter__factory.abi,
          LinearStepFunctionInterestSetter__factory.bytecode,
          getLinearStepFunctionInterestSetterConstructorParams(upperRate, lowerRate, optimalRate),
        ),
        'LinearStepFunctionInterestSetter: Lower optimal percent too high',
      );
    });

    it('should fail when optimal is too low', async () => {
      await expectThrow(
        createContractWithAbi<LinearStepFunctionInterestSetter>(
          LinearStepFunctionInterestSetter__factory.abi,
          LinearStepFunctionInterestSetter__factory.bytecode,
          getLinearStepFunctionInterestSetterConstructorParams(lowerRate, upperRate, ZERO_BI),
        ),
        'LinearStepFunctionInterestSetter: Invalid optimal utilization',
      );
    });

    it('should fail when optimal is too high', async () => {
      await expectThrow(
        createContractWithAbi<LinearStepFunctionInterestSetter>(
          LinearStepFunctionInterestSetter__factory.abi,
          LinearStepFunctionInterestSetter__factory.bytecode,
          getLinearStepFunctionInterestSetterConstructorParams(lowerRate, upperRate, ethers.constants.WeiPerEther),
        ),
        'LinearStepFunctionInterestSetter: Invalid optimal utilization',
      );
    });
  });

  describe('#getInterestRate', () => {
    it('Succeeds for 0/0', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 0, 0);
      expect(rate.value).to.eq(zero.div(secondsPerYear));
    });

    it('Succeeds for 0/100', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 0, 100);
      expect(rate.value).to.eq(zero.div(secondsPerYear));
    });

    it('Succeeds for 100/0', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 100, 0);
      expect(rate.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));
    });

    it('Succeeds for 100/100', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 100, 100);
      expect(rate.value).to.eq(maximumRate.div(secondsPerYear));
    });

    it('Succeeds for 200/100', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 200, 100);
      expect(rate.value).to.eq(maximumRate.div(secondsPerYear));
    });

    it('Succeeds for 50/100', async () => {
      const rate = await interestSetter.getInterestRate(ZERO_ADDRESS, 50, 100);
      expect(rate.value).to.eq(BigNumber.from('33333333333333333').div(secondsPerYear)); // 3.3%
    });

    it('Succeeds for 0-90% (javascript)', async () => {
      const rate1 = await interestSetter.getInterestRate(ZERO_ADDRESS, 0, 100);
      expect(rate1.value).to.eq(zero.div(secondsPerYear)); // 0%

      const rate2 = await interestSetter.getInterestRate(ZERO_ADDRESS, 45, 100);
      expect(rate2.value).to.eq(BigNumber.from('30000000000000000').div(secondsPerYear)); // 3%

      const rate3 = await interestSetter.getInterestRate(ZERO_ADDRESS, 90, 100);
      expect(rate3.value).to.eq(BigNumber.from('60000000000000000').div(secondsPerYear)); // 6%
    });

    it('Succeeds for 91-100% (javascript)', async () => {
      const rate1 = await interestSetter.getInterestRate(ZERO_ADDRESS, 91, 100);
      expect(rate1.value).to.eq(BigNumber.from('160000000000000000').div(secondsPerYear)); // 16%

      const rate2 = await interestSetter.getInterestRate(ZERO_ADDRESS, 95, 100);
      expect(rate2.value).to.eq(BigNumber.from('560000000000000000').div(secondsPerYear)); // 56%

      const rate3 = await interestSetter.getInterestRate(ZERO_ADDRESS, 99, 100);
      expect(rate3.value).to.eq(BigNumber.from('960000000000000000').div(secondsPerYear)); // 96%

      const rate4 = await interestSetter.getInterestRate(ZERO_ADDRESS, 100, 100);
      expect(rate4.value).to.eq(BigNumber.from('1060000000000000000').div(secondsPerYear)); // 106%
    });
  });
});
