import { expect } from 'chai';
import {
  OARB,
  OARB__factory,
  TestVesterImplementationV2,
  TestVesterImplementationV2__factory,
  VesterImplementationLibForV2,
  VesterImplementationLibForV2__factory,
  VesterProxy,
  VesterProxy__factory,
} from '../src/types';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createContractWithLibrary } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

describe('VesterProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let implementation: TestVesterImplementationV2;
  let oARB: OARB;
  let library: VesterImplementationLibForV2;

  let proxy: VesterProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);

    library = await createContractWithAbi<VesterImplementationLibForV2>(
      VesterImplementationLibForV2__factory.abi,
      VesterImplementationLibForV2__factory.bytecode,
      [],
    );
    implementation = await createContractWithLibrary<TestVesterImplementationV2>(
      'TestVesterImplementationV2',
      { VesterImplementationLibForV2: library.address },
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.tokens.weth.address,
        core.tokens.arb!.address,
      ],
    );

    const calldata = await implementation.populateTransaction.initialize(
      defaultAbiCoder.encode(['address'], [oARB.address])
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
      const vester = TestVesterImplementationV2__factory.connect(proxy.address, core.hhUser1);
      expect(await vester.levelRequestFee()).to.eq(parseEther('0.0003'));
    });
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createContractWithLibrary<TestVesterImplementationV2>(
        'TestVesterImplementationV2',
        { VesterImplementationLibForV2: library.address },
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
      const newImplementation = await createContractWithLibrary<TestVesterImplementationV2>(
        'TestVesterImplementationV2',
        { VesterImplementationLibForV2: library.address },
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
      const newImplementation = await createContractWithLibrary<TestVesterImplementationV2>(
        'TestVesterImplementationV2',
        { VesterImplementationLibForV2: library.address },
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
        'VesterImplementationV2: Invalid force close position tax',
      );
    });
  });
});
