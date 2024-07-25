import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { PendlePtIsolationModeTokenVaultV1, PendlePtIsolationModeVaultFactory, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtUSDeDec2024IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let pendleRegistry: PendleRegistry;
  let vaultImplementation: PendlePtIsolationModeTokenVaultV1;
  let factory: PendlePtIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 66_900_050,
      network: Network.Mantle,
    });
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem.usdeDec2024.usdeMarket,
      core.pendleEcosystem.usdeDec2024.ptOracle,
      core.pendleEcosystem.usdeDec2024.syUsdeToken,
    );
    vaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem.usdeDec2024.ptUSDeToken,
      vaultImplementation,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.pendleRegistry()).to.equal(pendleRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem.usdeDec2024.ptUSDeToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPendleRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetPendleRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'PendleRegistrySet', {
        pendleRegistry: OTHER_ADDRESS,
      });
      expect(await factory.pendleRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetPendleRegistry(OTHER_ADDRESS),
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
