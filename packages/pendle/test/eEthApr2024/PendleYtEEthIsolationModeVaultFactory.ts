import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { PendleRegistry, PendleYtIsolationModeTokenVaultV1, PendleYtIsolationModeVaultFactory } from '../../src/types';
import {
  createPendleRegistry,
  createPendleYtIsolationModeTokenVaultV1,
  createPendleYtIsolationModeVaultFactory,
} from '../pendle-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const initialAllowableDebtMarketIds = [0, 1];

describe('PendleYtEEthJun2024IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let pendleRegistry: PendleRegistry;
  let vaultImplementation: PendleYtIsolationModeTokenVaultV1;
  let factory: PendleYtIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthJun2024.weEthMarket,
      core.pendleEcosystem!.weEthJun2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    vaultImplementation = await createPendleYtIsolationModeTokenVaultV1();
    factory = await createPendleYtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      initialAllowableDebtMarketIds,
      [],
      core.pendleEcosystem!.weEthJun2024.ytWeEthToken,
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
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem!.weEthJun2024.ytWeEthToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPendleGLPRegistry', () => {
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
      const allowableDebtMarketIds = await factory.allowableDebtMarketIds();
      expect(allowableDebtMarketIds.length).to.equal(2);
      expect(allowableDebtMarketIds[0]).to.equal(0);
      expect(allowableDebtMarketIds[1]).to.equal(1);
    });
  });
});
