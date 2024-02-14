import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CustomTestToken, TestERC20Lib, TestERC20Lib__factory } from '../../src/types';
import { createContractWithAbi, createTestToken } from '../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

const amount1 = BigNumber.from('200000000');
const amount2 = BigNumber.from('500000000');

describe('ERC20Lib', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let testLib: TestERC20Lib;
  let token1: CustomTestToken;
  let token2: CustomTestToken;
  let spender1: string;
  let spender2: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    testLib = await createContractWithAbi<TestERC20Lib>(
      TestERC20Lib__factory.abi,
      TestERC20Lib__factory.bytecode,
      [],
    );

    token1 = await createTestToken();
    token2 = await createTestToken();
    spender1 = core.hhUser1.address;
    spender2 = core.hhUser2.address;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('resetAllowanceIfNeededAndApprove', () => {
    it('should work for various tokens', async () => {
      await expectAllowance(token1, spender1, ZERO_BI);
      await expectAllowance(token1, spender2, ZERO_BI);
      await expectAllowance(token2, spender1, ZERO_BI);
      await expectAllowance(token2, spender2, ZERO_BI);

      await testLib.resetAllowanceIfNeededAndApprove(token1.address, spender1, amount1);
      await expectAllowance(token1, spender1, amount1);
      await expectAllowance(token1, spender2, ZERO_BI);
      await expectAllowance(token2, spender1, ZERO_BI);
      await expectAllowance(token2, spender2, ZERO_BI);

      // reset the allowance to be larger
      await testLib.resetAllowanceIfNeededAndApprove(token1.address, spender1, amount2);
      await expectAllowance(token1, spender1, amount2);
      await expectAllowance(token1, spender2, ZERO_BI);
      await expectAllowance(token2, spender1, ZERO_BI);
      await expectAllowance(token2, spender2, ZERO_BI);

      await testLib.resetAllowanceIfNeededAndApprove(token2.address, spender1, amount1);
      await expectAllowance(token1, spender1, amount2);
      await expectAllowance(token1, spender2, ZERO_BI);
      await expectAllowance(token2, spender1, amount1);
      await expectAllowance(token2, spender2, ZERO_BI);

      await testLib.resetAllowanceIfNeededAndApprove(token2.address, spender2, amount2);
      await expectAllowance(token1, spender1, amount2);
      await expectAllowance(token1, spender2, ZERO_BI);
      await expectAllowance(token2, spender1, amount1);
      await expectAllowance(token2, spender2, amount2);
    });
  });

  async function expectAllowance(token: CustomTestToken, spender: string, expected: BigNumber) {
    expect(await token.allowance(testLib.address, spender)).to.eq(expected);
  }
});
