import { expect } from 'chai';
import { DepositWithdrawalRouter, DepositWithdrawalRouter__factory, RouterProxy } from '../../src/types';
import { Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createRouterProxy } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

describe('RouterProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let implementation: DepositWithdrawalRouter;
  let router: RouterProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    implementation = await createContractWithAbi<DepositWithdrawalRouter>(
      DepositWithdrawalRouter__factory.abi,
      DepositWithdrawalRouter__factory.bytecode,
      [core.tokens.weth.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const calldata = await implementation.populateTransaction.initialize();
    router = await createRouterProxy(implementation.address, calldata.data!, core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createContractWithAbi<DepositWithdrawalRouter>(
        DepositWithdrawalRouter__factory.abi,
        DepositWithdrawalRouter__factory.bytecode,
        [core.tokens.weth.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
      await expectEvent(
        router,
        await router.connect(core.governance).upgradeTo(newImplementation.address),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await router.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        router.connect(core.hhUser1).upgradeTo(implementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      await expectThrow(
        router.connect(core.governance).upgradeTo(core.hhUser1.address),
        'RouterProxy: Implementation is not a contract',
      );
    });
  });

  describe('#upgradeToAndCall', () => {
    it('should work normally', async () => {
      const newImplementation = await createContractWithAbi<DepositWithdrawalRouter>(
        DepositWithdrawalRouter__factory.abi,
        DepositWithdrawalRouter__factory.bytecode,
        [core.tokens.weth.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
      const calldata = await newImplementation.populateTransaction.WRAPPED_PAYABLE_TOKEN();
      await expectEvent(
        router,
        await router.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await router.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      const calldata = await implementation.populateTransaction.WRAPPED_PAYABLE_TOKEN();
      await expectThrow(
        router.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await implementation.populateTransaction.WRAPPED_PAYABLE_TOKEN();
      await expectThrow(
        router.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'RouterProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const newImplementation = await createContractWithAbi<DepositWithdrawalRouter>(
        DepositWithdrawalRouter__factory.abi,
        DepositWithdrawalRouter__factory.bytecode,
        [core.tokens.weth.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
      const calldata = await implementation.populateTransaction.depositPayable(
        ZERO_BI,
        ZERO_BI,
        ZERO_BI,
      );
      await expectThrow(
        router.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        `Storage: Unpermissioned operator <${router.address.toLowerCase()}>`,
      );
    });
  });
});
