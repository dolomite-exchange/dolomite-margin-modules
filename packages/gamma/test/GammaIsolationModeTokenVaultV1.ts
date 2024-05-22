import { expect } from 'chai';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GammaIsolationModeTokenVaultV1, GammaIsolationModeTokenVaultV1__factory, GammaIsolationModeVaultFactory, GammaRegistry } from '../src/types';
import { createGammaIsolationModeTokenVaultV1, createGammaIsolationModeVaultFactory, createGammaRegistry, createGammaUnwrapperTraderV2, createGammaWrapperTraderV2 } from './gamma-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GammaIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaRegistry: GammaRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let gammaVault: GammaIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 213_000_000,
      network: Network.ArbitrumOne,
    });

    gammaRegistry = await createGammaRegistry(core);

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(gammaRegistry, core.gammaEcosystem.gammaPools.wethUsdc, vaultImplementation, core);

    unwrapper = await createGammaUnwrapperTraderV2(gammaFactory, core);
    wrapper = await createGammaWrapperTraderV2(gammaFactory, core);

    await core.testEcosystem!.testPriceOracle.setPrice(gammaFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, gammaFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);
    gammaVault = setupUserVaultProxy<GammaIsolationModeTokenVaultV1>(
      await gammaFactory.getVaultByAccount(core.hhUser1.address),
      GammaIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await gammaVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await gammaVault.registry()).to.equal(gammaRegistry.address);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await gammaVault.isExternalRedemptionPaused()).to.equal(false);
    });
  });
});
