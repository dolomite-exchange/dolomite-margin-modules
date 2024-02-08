import { expect } from 'chai';
import { TestSafeDelegateCallLib } from '../../src/types';
import { createContractWithLibrary, createContractWithName } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { expectThrow } from '../utils/assertions';

describe('SafeDelegateCallLib', () => {
  let snapshotId: string;
  let safeDelegateCallLib: TestSafeDelegateCallLib;

  before(async () => {
    const lib = await createContractWithName('SafeDelegateCallLib', []);
    safeDelegateCallLib = await createContractWithLibrary<TestSafeDelegateCallLib>(
      'TestSafeDelegateCallLib',
      { SafeDelegateCallLib: lib.address },
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#safeDelegateCall', () => {
    it('should work normally', async () => {
      const calldata = await safeDelegateCallLib.populateTransaction.setValue(10);
      await safeDelegateCallLib.safeDelegateCall(safeDelegateCallLib.address, calldata.data!);
      expect(await safeDelegateCallLib.value()).to.eq(10);
    });

    it('should revert if call reverts with message', async () => {
      const calldata = await safeDelegateCallLib.populateTransaction.revertFunction();
      await expectThrow(
        safeDelegateCallLib.safeDelegateCall(safeDelegateCallLib.address, calldata.data!),
        'No reversion message!',
      );
    });

    it('should revert if call reverts with message', async () => {
      const calldata = await safeDelegateCallLib.populateTransaction.revertFunctionWithMessage();
      await expectThrow(
        safeDelegateCallLib.safeDelegateCall(safeDelegateCallLib.address, calldata.data!),
        'TestSafeDelegateCallLib: revertFunction',
      );
    });
  });
});
