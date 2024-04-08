import { expect } from 'chai';
import { TestChainHelperLib, TestChainHelperLib__factory } from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';

const ARBITRUM_ONE = 42161;
const ARBITRUM_SEPOLIA = 421614;

describe('ChainHelperLib', () => {
  let snapshotId: string;
  let testLib: TestChainHelperLib;

  before(async () => {
    testLib = await createContractWithAbi<TestChainHelperLib>(
      TestChainHelperLib__factory.abi,
      TestChainHelperLib__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#isArbitrum', () => {
    it('should work normally', async () => {
      expect(await testLib.isArbitrum(ARBITRUM_ONE)).to.be.true;
      expect(await testLib.isArbitrum(ARBITRUM_SEPOLIA)).to.be.true;
    });

    it('should fail if not arbitrum', async () => {
      expect(await testLib.isArbitrum(ZERO_BI)).to.be.false;
    });
  });
});
