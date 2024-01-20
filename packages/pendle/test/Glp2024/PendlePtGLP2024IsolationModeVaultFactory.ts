import { expect } from 'chai';
import {
  PendleGLPRegistry,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeVaultFactory,
} from '../../../../src/types';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../../packages/base/test/utils';
import { expectEvent, expectThrow } from '../../../../packages/base/test/utils/assertions';
import {
  createPendleGLPRegistry,
  createPendlePtGLP2024IsolationModeTokenVaultV1,
  createPendlePtGLP2024IsolationModeVaultFactory,
} from '@dolomite-exchange/modules-pendle/test/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../../packages/base/test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtGLP2024IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let pendleRegistry: PendleGLPRegistry;
  let vaultImplementation: PendlePtGLP2024IsolationModeTokenVaultV1;
  let factory: PendlePtGLP2024IsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    pendleRegistry = await createPendleGLPRegistry(core);
    vaultImplementation = await createPendlePtGLP2024IsolationModeTokenVaultV1();
    factory = await createPendlePtGLP2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.glpMar2024.ptGlpToken,
      vaultImplementation,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.pendlePtGLP2024Registry()).to.equal(pendleRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem!.glpMar2024.ptGlpToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPendleGLPRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetPendlePtGLP2024Registry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'PendlePtGLP2024RegistrySet', {
        pendlePtGLP2024Registry: OTHER_ADDRESS,
      });
      expect(await factory.pendlePtGLP2024Registry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetPendlePtGLP2024Registry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
