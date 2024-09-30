import { ADDRESS_ZERO, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  AccountTransferReceiver,
  AccountTransferReceiver__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  SignalAccountTransferImplementation,
  SignalAccountTransferImplementation__factory,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
  TestGMXIsolationModeTokenVaultV1,
  TestGMXIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createTestGLPIsolationModeTokenVaultV2,
  createTestGMXIsolationModeTokenVaultV1,
} from './glp-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const gmxAmount = parseEther('10'); // 10 GMX
const accountNumber = ZERO_BI;
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

describe('AccountTransferReceiver', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxVault: TestGMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let transferReceiver: AccountTransferReceiver;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 249_700_000,
      network: Network.ArbitrumOne,
    });

    const glpVaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    const vaultImplementation = await createTestGMXIsolationModeTokenVaultV1();
    glpFactory = core.gmxEcosystem!.live.dGlp.connect(core.hhUser1);
    gmxFactory = core.gmxEcosystem!.live.dGmx.connect(core.hhUser1);
    await glpFactory.connect(core.governance).setUserVaultImplementation(glpVaultImplementation.address);
    await gmxFactory.connect(core.governance).ownerSetUserVaultImplementation(vaultImplementation.address);

    const gmxRegistryImplementation = await createContractWithAbi<GmxRegistryV1>(
      GmxRegistryV1__factory.abi,
      GmxRegistryV1__factory.bytecode,
      []
    );
    const signalAccountTransferImpl = await createContractWithAbi<SignalAccountTransferImplementation>(
      SignalAccountTransferImplementation__factory.abi,
      SignalAccountTransferImplementation__factory.bytecode,
      [core.gmxEcosystem.live.gmxRegistryProxy.address]
    );
    await core.gmxEcosystem!.live.gmxRegistryProxy.connect(core.governance).upgradeTo(
      gmxRegistryImplementation.address
    );
    await core.gmxEcosystem.live.gmxRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
    await core.gmxEcosystem.live.gmxRegistry.connect(core.governance).ownerSetSignalAccountTransferImpl(
      signalAccountTransferImpl.address
    );

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<TestGMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      TestGMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );
    transferReceiver = AccountTransferReceiver__factory.connect(
      await glpVault.getAccountTransferOutReceiverAddress(),
      core.hhUser1
    );

    await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
    await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
    await gmxVault.requestAccountTransfer();
    await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, 0);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await transferReceiver.VAULT()).to.eq(glpVault.address);
      expect(await transferReceiver.OWNER()).to.eq(core.hhUser1.address);
      expect(await transferReceiver.REGISTRY()).to.eq(core.gmxEcosystem.live.gmxRegistry.address);
    });
  });

  describe('#signalAccountTransfer', () => {
    it('should work normally', async () => {
      const res = await transferReceiver.signalAccountTransfer(core.hhUser3.address);
      await expectEvent(transferReceiver, res, 'AccountTransferSignaled', {
        receiver: core.hhUser3.address,
      });
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(transferReceiver.address))
        .to.eq(core.hhUser3.address);
    });

    it('should work if user signals to same address multiple times', async () => {
      await transferReceiver.signalAccountTransfer(core.hhUser3.address);
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(transferReceiver.address))
        .to.eq(core.hhUser3.address);
      await transferReceiver.cancelAccountTransfer();
      await expectThrow(
        core.gmxEcosystem.gmxRewardsRouterV3.connect(core.hhUser3).acceptTransfer(transferReceiver.address),
        'transfer not signalled'
      );
      await transferReceiver.signalAccountTransfer(core.hhUser3.address);
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(transferReceiver.address))
        .to.eq(core.hhUser3.address);
      await core.gmxEcosystem.gmxRewardsRouterV3.connect(core.hhUser3).acceptTransfer(transferReceiver.address);
    });

    it('should fail if receiver is the vault', async () => {
      await expectThrow(
        transferReceiver.signalAccountTransfer(glpVault.address),
        'AccountTransferReceiver: Receiver cannot be vault'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        transferReceiver.connect(core.hhUser2).signalAccountTransfer(core.hhUser3.address),
        'AccountTransferReceiver: Caller must be owner'
      );
    });
  });

  describe('#cancelAccountTransfer', () => {
    it('should work normally', async () => {
      await transferReceiver.signalAccountTransfer(core.hhUser3.address);
      await transferReceiver.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(transferReceiver.address))
        .to.eq(DEAD_ADDRESS);
      await expectThrow(
        core.gmxEcosystem.gmxRewardsRouterV3.connect(core.hhUser3).acceptTransfer(transferReceiver.address),
        'transfer not signalled'
      );
      expect(await transferReceiver.receiver()).to.eq(DEAD_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        transferReceiver.connect(core.hhUser2).cancelAccountTransfer(),
        'AccountTransferReceiver: Caller must be owner'
      );
    });
  });
});
