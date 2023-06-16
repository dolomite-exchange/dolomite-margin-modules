import { BigNumber } from 'ethers';
import { TestInterestIndexLib, TestInterestIndexLib__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const amount1 = BigNumber.from('200000000');
const amount2 = BigNumber.from('500000000');

describe('InterestIndexLib', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let testLib: TestInterestIndexLib;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 90_000_000,
      network: Network.ArbitrumOne,
    });
    testLib = await createContractWithAbi<TestInterestIndexLib>(
      TestInterestIndexLib__factory.abi,
      TestInterestIndexLib__factory.bytecode,
      [core.dolomiteMargin],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('parToWei', () => {
    it('should work for positive numbers', async () => {
    });

    it('should work for negative numbers', async () => {
    });
  });

  describe('weiToPar', () => {
    it('should work for positive numbers', async () => {
    });

    it('should work for negative numbers', async () => {
    });
  });
});
