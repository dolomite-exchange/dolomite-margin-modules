import { expect } from 'chai';
import { TestReentrancyGuardUpgradeable, TestReentrancyGuardUpgradeable__factory } from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';

describe('ReentrancyGuardUpgradeable', () => {
  let snapshotId: string;
  let reentrancyGuardUpgradeable: TestReentrancyGuardUpgradeable;

  before(async () => {
    reentrancyGuardUpgradeable = await createContractWithAbi<TestReentrancyGuardUpgradeable>(
      TestReentrancyGuardUpgradeable__factory.abi,
      TestReentrancyGuardUpgradeable__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      await expect(reentrancyGuardUpgradeable.initialize()).to.not.be.reverted;
    });
  });

  describe('#testNonreentrant', () => {
    it('should work normally', async () => {
      await expect(reentrancyGuardUpgradeable.testNonreentrant()).to.not.be.reverted;
    });
  });

  describe('#testTriggerReentrancy', () => {
    it('should revert', async () => {
      await expect(reentrancyGuardUpgradeable.testTriggerReentrancy()).to.be.reverted;
    });
  });
});
