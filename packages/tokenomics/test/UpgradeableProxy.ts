import {
  createContractWithAbi
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  DOLO,
  TestOptionAirdrop,
  TestOptionAirdrop__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
} from '../src/types';
import { createDOLO, createTestOptionAirdropImplementation } from './tokenomics-ecosystem-utils';

describe('UpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let optionAirdrop: TestOptionAirdrop;
  let proxy: UpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core);

    const optionAirdropImplementation = await createTestOptionAirdropImplementation(core, dolo);
    const calldata = await optionAirdropImplementation.populateTransaction.initialize(
      core.hhUser5.address,
    );
    proxy = await createContractWithAbi<UpgradeableProxy>(
      UpgradeableProxy__factory.abi,
      UpgradeableProxy__factory.bytecode,
      [optionAirdropImplementation.address, core.dolomiteMargin.address, calldata.data!],
    );
    optionAirdrop = TestOptionAirdrop__factory.connect(proxy.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      expect(await optionAirdrop.treasury()).to.eq(core.hhUser5.address);
    });
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createTestOptionAirdropImplementation(core, dolo);
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
        proxy.connect(core.hhUser1).upgradeTo(optionAirdrop.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      await expectThrow(
        proxy.connect(core.governance).upgradeTo(core.hhUser1.address),
        'UpgradeableProxy: Implementation is not a contract',
      );
    });
  });

  describe('#upgradeToAndCall', () => {
    it('should work normally', async () => {
      const newImplementation = await createTestOptionAirdropImplementation(core, dolo);
      const calldata = await newImplementation.populateTransaction.ownerSetTreasury(
        core.hhUser3.address
      );
      await expectEvent(
        proxy,
        await proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await proxy.implementation()).to.equal(newImplementation.address);
      expect(await optionAirdrop.treasury()).to.equal(core.hhUser3.address);
    });

    it('should fail when not called by owner', async () => {
      const calldata = await optionAirdrop.populateTransaction.ownerSetTreasury(core.hhUser1.address);
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeToAndCall(optionAirdrop.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await optionAirdrop.populateTransaction.ownerSetTreasury(core.hhUser1.address);
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'UpgradeableProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const newImplementation = await createTestOptionAirdropImplementation(core, dolo);
      const calldata = await newImplementation.populateTransaction.ownerSetTreasury(
        ADDRESS_ZERO
      );
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'OptionAirdrop: Invalid treasury address',
      );
    });
  });
});
