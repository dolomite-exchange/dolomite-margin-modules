import { ADDRESSES, INTEGERS } from '@dolomite-exchange/dolomite-margin';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { TestRequire, TestRequire__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectThrow } from '../../../packages/base/test/utils/assertions';

chai.use(solidity);

describe('Require', () => {
  let snapshotId: string;

  let testRequire: TestRequire;

  before(async () => {
    testRequire = await createContractWithAbi<TestRequire>(
      TestRequire__factory.abi,
      TestRequire__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Require', () => {
    const bytes32Hex = `0x${'0123456789abcdef'.repeat(4)}`;
    const emptyReason = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const reason1 = '0x5468697320497320746865205465787420526561736f6e2e3031323334353637';
    const reasonString1 = 'This Is the Text Reason.01234567';
    const reason2 = '0x53686f727420526561736f6e2030393800000000000000000000000000000000';
    const reasonString2 = 'Short Reason 098';
    const arg1 = '0';
    const arg2 = '1234567890987654321';
    const arg3 = INTEGERS.ONES_255.toFixed(0);
    const addr = ADDRESSES.TEST[0];

    it('that (emptyString)', async () => {
      await expectThrow(
        testRequire.RequireThat1(emptyReason, arg1),
        `TestRequire:  <${arg1}>`,
      );
    });

    it('that (0 args)', async () => {
      await expectThrow(
        testRequire.RequireThat0(reason1),
        `TestRequire: ${reasonString1}`,
      );
    });

    it('that (1 args)', async () => {
      await expectThrow(
        testRequire.RequireThat1(reason2, arg1),
        `TestRequire: ${reasonString2} <${arg1}>`,
      );
    });

    it('that (2 args)', async () => {
      await expectThrow(
        testRequire.RequireThat2(reason1, arg2, arg3),
        `TestRequire: ${reasonString1} <${arg2}, ${arg3}>`,
      );
      await testRequire.RequireThat2IsTrue(reason1, arg2, arg3);
    });

    it('that (address arg)', async () => {
      await expectThrow(
        testRequire.RequireThatA0(reason2, addr),
        `TestRequire: ${reasonString2} <${addr}>`,
      );
      await testRequire.RequireThatA0IsTrue(reason2, addr);
    });

    it('that (1 address, 1 number)', async () => {
      await expectThrow(
        testRequire.RequireThatA1(reason2, addr, arg1),
        `TestRequire: ${reasonString2} <${addr}, ${arg1}>`,
      );
      await testRequire.RequireThatA1IsTrue(reason2, addr, arg1);
    });

    it('that (1 address, 2 numbers)', async () => {
      await expectThrow(
        testRequire.RequireThatA2(reason2, addr, arg1, arg3),
        `TestRequire: ${reasonString2} <${addr}, ${arg1}, ${arg3}>`,
      );
      await testRequire.RequireThatA2IsTrue(reason2, addr, arg1, arg3);
    });

    it('that (bytes32 arg)', async () => {
      await expectThrow(
        testRequire.RequireThatB0(reason1, bytes32Hex),
        `TestRequire: ${reasonString1} <${bytes32Hex}>`,
      );
      await testRequire.RequireThatB0IsTrue(reason1, bytes32Hex);
    });

    it('that (1 bytes32, 2 numbers)', async () => {
      await expectThrow(
        testRequire.RequireThatB2(reason2, bytes32Hex, arg1, arg3),
        `TestRequire: ${reasonString2} <${bytes32Hex}, ${arg1}, ${arg3}>`,
      );
      await testRequire.RequireNotThatB2(reason2, bytes32Hex, arg1, arg3);
    });
  });
});
