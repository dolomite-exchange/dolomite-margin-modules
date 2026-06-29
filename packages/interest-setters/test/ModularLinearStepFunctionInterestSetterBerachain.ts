import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { disableInterestAccrual, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TestChronicleScribe, TestChronicleScribe__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { subWei } from 'packages/base/src/utils/math-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  ModularLinearStepFunctionInterestSetterBerachain,
  ModularLinearStepFunctionInterestSetterBerachain__factory,
} from '../src/types';

const WETH_PRICE = parseUnits('2260', 18);
const BERA_PRICE = parseUnits('0.20', 18);
const GAS_LIMIT = BigNumber.from(`${125_000}`);

const lowerRate = BigNumber.from('60000000000000000');
const upperRate = BigNumber.from('1000000000000000000');
const optimalRate = BigNumber.from('900000000000000000');
const secondsPerYear = BigNumber.from(31_536_000);

describe('ModularLinearStepFunctionInterestSetterBerachain', () => {
  let core: CoreProtocolBerachain;
  let snapshotId: string;
  let interestSetter: ModularLinearStepFunctionInterestSetterBerachain;
  let scribeWeth: TestChronicleScribe;
  let scribeWbera: TestChronicleScribe;
  let scribeUsdc: TestChronicleScribe;

  before(async () => {
    core = (await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 22737400,
    })) as CoreProtocolBerachain;

    scribeWeth = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    scribeWbera = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    scribeUsdc = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );

    await scribeWeth.setLatestAnswer(WETH_PRICE);
    await scribeWeth.setDecimals(18);
    await scribeWbera.setLatestAnswer(BERA_PRICE);
    await scribeWbera.setDecimals(18);
    await scribeUsdc.setLatestAnswer(parseEther('1')); // USDC = $1
    await scribeUsdc.setDecimals(18);

    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(core.tokens.weth.address, scribeWeth.address, false);
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(core.tokens.wbera.address, scribeWbera.address, false);
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(core.tokens.usdc.address, scribeUsdc.address, false);

    interestSetter = await createContractWithAbi<ModularLinearStepFunctionInterestSetterBerachain>(
      ModularLinearStepFunctionInterestSetterBerachain__factory.abi,
      ModularLinearStepFunctionInterestSetterBerachain__factory.bytecode,
      [core.dolomiteMargin.address, core.dolomiteRegistry.address, GAS_LIMIT],
    );

    await interestSetter
      .connect(core.governance)
      .ownerSetSettingsByToken(core.tokens.weth.address, lowerRate, upperRate, optimalRate);
    await interestSetter
      .connect(core.governance)
      .ownerSetSettingsByToken(core.tokens.usdc.address, lowerRate, upperRate, optimalRate);
    await interestSetter
      .connect(core.governance)
      .ownerSetSettingsByToken(core.tokens.wbtc.address, lowerRate, upperRate, optimalRate);

    await disableInterestAccrual(core, core.marketIds.wbtc);

    const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.wbtc);
    console.log('index', index.supply.toString());

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetSettingsByToken', () => {
    it('should succeed when called normally', async () => {
      const result = await interestSetter
        .connect(core.governance)
        .ownerSetSettingsByToken(core.tokens.wbtc.address, lowerRate, upperRate, optimalRate);
      await expectEvent(interestSetter, result, 'SettingsChanged', {
        token: core.tokens.wbtc.address,
        lowerOptimalPercent: lowerRate,
        upperOptimalPercent: upperRate,
        optimalUtilization: optimalRate,
      });

      expect(await interestSetter.getLowerOptimalPercentByToken(core.tokens.wbtc.address)).to.eq(lowerRate);
      expect(await interestSetter.getUpperOptimalPercentByToken(core.tokens.wbtc.address)).to.eq(upperRate);
      expect(await interestSetter.getOptimalUtilizationByToken(core.tokens.wbtc.address)).to.eq(optimalRate);
      expect((await interestSetter.getSettingsByToken(core.tokens.wbtc.address)).optimalUtilization).to.eq(optimalRate);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        interestSetter
          .connect(core.hhUser1)
          .ownerSetSettingsByToken(core.tokens.wbtc.address, lowerRate, upperRate, optimalRate),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });

    it('should fail when rates are inverted', async () => {
      await expectThrow(
        interestSetter
          .connect(core.governance)
          .ownerSetSettingsByToken(core.tokens.wbtc.address, upperRate, lowerRate, optimalRate),
        'ModularLinearStepInterestSetterB: Lower optimal percent too high',
      );
    });

    it('should fail when optimal is too low', async () => {
      await expectThrow(
        interestSetter
          .connect(core.governance)
          .ownerSetSettingsByToken(core.tokens.wbtc.address, lowerRate, upperRate, ZERO_BI),
        'ModularLinearStepInterestSetterB: Invalid optimal utilization',
      );
    });

    it('should fail when optimal is too high', async () => {
      await expectThrow(
        interestSetter
          .connect(core.governance)
          .ownerSetSettingsByToken(core.tokens.wbtc.address, lowerRate, upperRate, ONE_ETH_BI),
        'ModularLinearStepInterestSetterB: Invalid optimal utilization',
      );
    });
  });

  describe('#ownerSetGasLimit', () => {
    it('can set the gas limit', async () => {
      const newGasLimit = BigNumber.from('300000');
      await interestSetter.connect(core.governance).ownerSetGasLimit(newGasLimit);
      expect(await interestSetter.gasLimit()).to.eq(newGasLimit);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        interestSetter.connect(core.hhUser1).ownerSetGasLimit(BigNumber.from('300000')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#getInterestRate', () => {
    it('returns the correct value for a token with 18 decimals and skips gas check', async () => {
      const rate = await interestSetter.getInterestRate(core.tokens.weth.address, parseEther('50'), parseEther('100'));
      // utilization = 50%, so rate = lowerRate * 0.5 / 0.9 = 6% * 0.5 / 0.9 = 3.33%
      expect(rate.value).to.eq(BigNumber.from('33333333333333333').div(secondsPerYear));
    });

    it('returns 0 when borrow is 0', async () => {
      const rate = await interestSetter.getInterestRate(core.tokens.weth.address, 0, parseEther('100'));
      expect(rate.value).to.eq(0);
    });

    it('returns upper bound when supply is 0', async () => {
      const rate = await interestSetter.getInterestRate(core.tokens.weth.address, parseEther('100'), 0);
      expect(rate.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));
    });

    it('returns upper bound when utilization >= 100%', async () => {
      const rate = await interestSetter.getInterestRate(core.tokens.weth.address, parseEther('101'), parseEther('100'));
      expect(rate.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));

      const rate2 = await interestSetter.getInterestRate(
        core.tokens.weth.address,
        parseEther('100'),
        parseEther('100'),
      );
      expect(rate2.value).to.eq(lowerRate.add(upperRate).div(secondsPerYear));
    });

    it('returns value in second linear phase when utilization > optimalUtilization', async () => {
      // utilization = 95%
      const rate = await interestSetter.getInterestRate(core.tokens.weth.address, parseEther('95'), parseEther('100'));
      // remainingOptimalUtilization = 10%
      // utilizationDiff = 5%
      // interestToAdd = upperRate * 0.05 / 0.10 = 100% * 0.5 = 50%
      // total interest = 50% + 6% = 56%
      expect(rate.value).to.eq(parseEther('0.56').div(secondsPerYear));
    });

    it('returns the correct value for a token with < 18 decimals when gas price is high enough', async () => {
      const rate = await interestSetter.getInterestRate(
        core.tokens.usdc.address,
        parseUnits('50', 6),
        parseUnits('100', 6),
        { gasPrice: parseUnits('1', 'gwei') },
      );
      expect(rate.value).to.eq(BigNumber.from('33333333333333333').div(secondsPerYear));
    });

    it(
      'reverts for a token with < 18 decimals when gas price is too low and excess has dropped due to claim',
      async () => {
        // 1. Perform the initial snapshot (excess will be 0)
        await interestSetter.snapshotExcessEarnings([core.marketIds.wbtc]);

        // 2. We need excess tokens to drop.
        await core.adminClaimExcessTokens
          .connect(core.gnosisSafe)
          .claimExcessTokens(core.tokens.wbtc.address, core.hhUser1.addressLower, false);

        const excessAfterClaim = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.wbtc);
        const excessBeforeClaim = await interestSetter.getSnapshotByToken(core.tokens.wbtc.address);
        const diff = subWei(excessAfterClaim, excessBeforeClaim);
        expect(diff.sign).to.eq(false);
        expect(diff.value).to.be.gt(ONE_BI);

        await expectThrow(
          interestSetter.getInterestRate(core.tokens.wbtc.address, parseUnits('50', 8), parseUnits('100', 8), {
            gasPrice: parseUnits('1', 'wei'),
          }),
          `ModularLinearStepInterestSetterB: Gas price too low <${core.tokens.wbtc.address.toLowerCase()}>`,
        );
      },
    );

    it('reverts when snapshotting too early', async () => {
      await interestSetter.snapshotExcessEarnings([core.marketIds.usdc]);
      await expectThrow(
        interestSetter.snapshotExcessEarnings([core.marketIds.usdc]),
        `ModularLinearStepInterestSetterB: Already snapshot <${core.marketIds.usdc}>`,
      );
    });

    it('succeeds snapshotting multiple markets', async () => {
      await interestSetter.snapshotExcessEarnings([core.marketIds.usdc, core.marketIds.weth]);
    });

    it('reverts when an invalid token is passed in', async () => {
      await expectThrow(
        interestSetter.getInterestRate(ZERO_ADDRESS, 0, 0),
        `ModularLinearStepInterestSetterB: Invalid token <${ZERO_ADDRESS}>`,
      );
    });
  });
});
