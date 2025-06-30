import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { IERC20 } from 'packages/base/src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  ModularLinearStepFunctionInterestSetter,
  ModularLinearStepFunctionInterestSetter__factory,
} from '../src/types';

const zero = BigNumber.from(0);
const lowerRate = BigNumber.from('60000000000000000');
const upperRate = BigNumber.from('1000000000000000000');
const optimalRate = BigNumber.from('900000000000000000');
const maximumRate = lowerRate.add(upperRate); // 106%
const secondsPerYear = BigNumber.from(31_536_000);
describe('ModularLinearStepFunctionInterestSetter', () => {
  let core: CoreProtocolArbitrumOne;
  let token: IERC20;
  let snapshotId: string;

  let interestSetter: ModularLinearStepFunctionInterestSetter;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    token = core.tokens.weth;

    interestSetter = await createContractWithAbi<ModularLinearStepFunctionInterestSetter>(
      ModularLinearStepFunctionInterestSetter__factory.abi,
      ModularLinearStepFunctionInterestSetter__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    await interestSetter
      .connect(core.governance)
      .ownerSetSettingsByToken(token.address, lowerRate, upperRate, optimalRate);

    expect(await interestSetter.interestSetterType()).to.eq(2); // modular

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetSettingsByToken', () => {
    it('should succeed when called normally', async () => {
      const result = await interestSetter
        .connect(core.governance)
        .ownerSetSettingsByToken(token.address, lowerRate, upperRate, optimalRate);
      await expectEvent(interestSetter, result, 'SettingsChanged', {
        token: token.address,
        lowerOptimalPercent: lowerRate,
        upperOptimalPercent: upperRate,
        optimalUtilization: optimalRate,
      });

      expect(await interestSetter.getLowerOptimalPercentByToken(token.address)).to.eq(lowerRate);
      expect(await interestSetter.getUpperOptimalPercentByToken(token.address)).to.eq(upperRate);
      expect(await interestSetter.getOptimalUtilizationByToken(token.address)).to.eq(optimalRate);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        interestSetter.connect(core.hhUser1).ownerSetSettingsByToken(token.address, lowerRate, upperRate, optimalRate),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });

    it('should fail when rates are inverted', async () => {
      await expectThrow(
        interestSetter
          .connect(core.governance)
          .ownerSetSettingsByToken(token.address, upperRate, lowerRate, optimalRate),
        'ModularLinearStepInterestSetter: Lower optimal percent too high',
      );
    });

    it('should fail when optimal is too low', async () => {
      await expectThrow(
        interestSetter.connect(core.governance).ownerSetSettingsByToken(token.address, lowerRate, upperRate, ZERO_BI),
        'ModularLinearStepInterestSetter: Invalid optimal utilization',
      );
    });

    it('should fail when optimal is too high', async () => {
      await expectThrow(
        interestSetter
          .connect(core.governance)
          .ownerSetSettingsByToken(token.address, lowerRate, upperRate, ONE_ETH_BI),
        'ModularLinearStepInterestSetter: Invalid optimal utilization',
      );
    });
  });

  describe('#getInterestRate', () => {
    it('Succeeds for 0/0', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 0, 0);
      expect(rate.value).to.eq(zero.div(secondsPerYear));
    });

    it('Succeeds for 0/100', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 0, 100);
      expect(rate.value).to.eq(zero.div(secondsPerYear));
    });

    it('Succeeds for 100/0', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 100, 0);
      expect(rate.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));
    });

    it('Succeeds for 100/100', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 100, 100);
      expect(rate.value).to.eq(maximumRate.div(secondsPerYear));
    });

    it('Succeeds for 200/100', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 200, 100);
      expect(rate.value).to.eq(maximumRate.div(secondsPerYear));
    });

    it('Succeeds for 50/100', async () => {
      const rate = await interestSetter.getInterestRate(token.address, 50, 100);
      expect(rate.value).to.eq(BigNumber.from('33333333333333333').div(secondsPerYear)); // 3.3%
    });

    it('Succeeds for 0-90% (javascript)', async () => {
      const rate1 = await interestSetter.getInterestRate(token.address, 0, 100);
      expect(rate1.value).to.eq(zero.div(secondsPerYear)); // 0%

      const rate2 = await interestSetter.getInterestRate(token.address, 45, 100);
      expect(rate2.value).to.eq(BigNumber.from('30000000000000000').div(secondsPerYear)); // 3%

      const rate3 = await interestSetter.getInterestRate(token.address, 90, 100);
      expect(rate3.value).to.eq(BigNumber.from('60000000000000000').div(secondsPerYear)); // 6%
    });

    it('Succeeds for 91-100% (javascript)', async () => {
      const rate1 = await interestSetter.getInterestRate(token.address, 91, 100);
      expect(rate1.value).to.eq(BigNumber.from('160000000000000000').div(secondsPerYear)); // 16%

      const rate2 = await interestSetter.getInterestRate(token.address, 95, 100);
      expect(rate2.value).to.eq(BigNumber.from('560000000000000000').div(secondsPerYear)); // 56%

      const rate3 = await interestSetter.getInterestRate(token.address, 99, 100);
      expect(rate3.value).to.eq(BigNumber.from('960000000000000000').div(secondsPerYear)); // 96%

      const rate4 = await interestSetter.getInterestRate(token.address, 100, 100);
      expect(rate4.value).to.eq(BigNumber.from('1060000000000000000').div(secondsPerYear)); // 106%
    });

    it('Fails when token is invalid', async () => {
      await expectThrow(
        interestSetter.getInterestRate(ADDRESS_ZERO, 0, 0),
        `ModularLinearStepInterestSetter: Invalid token <${ADDRESS_ZERO}>`,
      );

      await expectThrow(
        interestSetter.getInterestRate(core.tokens.usdc.address, 0, 0),
        `ModularLinearStepInterestSetter: Invalid token <${core.tokens.usdc.address.toLowerCase()}>`,
      );
    });
  });
});
