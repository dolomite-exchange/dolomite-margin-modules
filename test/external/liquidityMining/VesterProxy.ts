import { expect } from 'chai';
import {
  OARB,
  OARB__factory,
  TestVesterImplementation,
  TestVesterImplementation__factory,
  VesterProxy,
  VesterProxy__factory,
} from '../../../src/types';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectEvent, expectThrow } from '../../../packages/base/test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../packages/base/test/utils/setup';

describe('VesterProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let implementation: TestVesterImplementation;
  let oARB: OARB;

  let proxy: VesterProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);

    implementation = await createContractWithAbi<TestVesterImplementation>(
      TestVesterImplementation__factory.abi,
      TestVesterImplementation__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.tokens.weth.address,
        core.tokens.arb!.address,
      ],
    );

    const calldata = await implementation.populateTransaction.initialize(
      oARB.address,
      'oARB RULEZ',
    );

    proxy = await createContractWithAbi<VesterProxy>(
      VesterProxy__factory.abi,
      VesterProxy__factory.bytecode,
      [implementation.address, core.dolomiteMargin.address, calldata.data!],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const vester = TestVesterImplementation__factory.connect(proxy.address, core.hhUser1);
      expect(await vester.oARB()).to.eq(oARB.address);
    });
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createContractWithAbi<TestVesterImplementation>(
        TestVesterImplementation__factory.abi,
        TestVesterImplementation__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          core.tokens.weth.address,
          core.tokens.arb!.address,
        ],
      );
      await expectEvent(
        proxy,
        await proxy.connect(core.governance).upgradeTo(newImplementation.address),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await proxy.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeTo(implementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      await expectThrow(
        proxy.connect(core.governance).upgradeTo(core.hhUser1.address),
        'IsolationModeVesterProxy: Implementation is not a contract',
      );
    });
  });

  describe('#upgradeToAndCall', () => {
    it('should work normally', async () => {
      const newImplementation = await createContractWithAbi<TestVesterImplementation>(
        TestVesterImplementation__factory.abi,
        TestVesterImplementation__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          core.tokens.weth.address,
          core.tokens.arb!.address,
        ],
      );
      const calldata = await newImplementation.populateTransaction.ownerSetForceClosePositionTax(
        100,
      );
      await expectEvent(
        proxy,
        await proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await proxy.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      const calldata = await implementation.populateTransaction.forceClosePositionTax();
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await implementation.populateTransaction.forceClosePositionTax();
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'IsolationModeVesterProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const newImplementation = await createContractWithAbi<TestVesterImplementation>(
        TestVesterImplementation__factory.abi,
        TestVesterImplementation__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          core.tokens.weth.address,
          core.tokens.arb!.address,
        ],
      );
      const calldata = await implementation.populateTransaction.ownerSetForceClosePositionTax(
        10000000,
      );
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'VesterImplementation: Invalid force close position tax',
      );
    });
  });
});
