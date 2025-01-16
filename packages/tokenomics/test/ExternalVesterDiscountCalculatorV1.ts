import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { ExternalVesterDiscountCalculatorV1, VoterAlwaysActive, VoterAlwaysActive__factory } from '../src/types';
import {
  createDOLO,
  createExternalVesterDiscountCalculatorV1,
  createVeFeeCalculator,
  createVotingEscrow,
} from './tokenomics-ecosystem-utils';

const BUYBACK_POOL_ADDRESS = '0x1111111111111111111111111111111111111111';

describe('ExternalVesterDiscountCalculatorV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let calculator: ExternalVesterDiscountCalculatorV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const dolo = await createDOLO(core, core.hhUser5.address);
    const voter = await createContractWithAbi<VoterAlwaysActive>(
      VoterAlwaysActive__factory.abi,
      VoterAlwaysActive__factory.bytecode,
      [],
    );
    const feeCalculator = await createVeFeeCalculator(core);
    const veDolo = await createVotingEscrow(
      core,
      dolo,
      voter.address,
      feeCalculator,
      ADDRESS_ZERO,
      BUYBACK_POOL_ADDRESS,
    );
    calculator = await createExternalVesterDiscountCalculatorV1(veDolo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#calculateLinearDiscount', () => {
    it('1 week duration', async () => {
      const discount = await calculator.calculateLinearDiscountWithinOneWeek(ONE_DAY_SECONDS * 7);
      expect(discount).to.eq('50000000000000000'); // 5%
    });

    it('2 weeks duration', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 + 1);
      expect(discount).to.eq('58737864077669902'); // 5.8737%
    });

    it('6 months', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 * 26);
      expect(discount).to.eq('163592233009708737'); // 16.3592%
    });

    it('1 year duration', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 * 52);
      expect(discount).to.eq('277184466019417475'); // 27.7%
    });

    it('21 months duration', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 * 91);
      expect(discount).to.eq('447572815533980582'); // 44.7%
    });

    it('2 year duration', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 * 104);
      expect(discount).to.eq('500000000000000000'); // 50.0%
    });

    it('2 year+ duration', async () => {
      const discount = await calculator.calculateLinearDiscount(ONE_DAY_SECONDS * 7 * 105);
      expect(discount).to.eq('500000000000000000'); // 50.0%
    });
  });
});
