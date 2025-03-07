import { expect } from 'chai';
import {
  BerachainRewardsRegistry,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeVaultFactory,
  POLIsolationModeVaultFactory__factory,
  POLIsolationModeWrapperTraderV2,
  POLIsolationModeWrapperTraderV2__factory,
  POLIsolationModeWrapperUpgradeableProxy,
  POLIsolationModeWrapperUpgradeableProxy__factory
} from '../src/types';
import { DolomiteERC4626, DolomiteERC4626__factory } from 'packages/base/src/types';
import { createDolomiteErc4626Proxy, createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';
import { createBerachainRewardsRegistry, createPOLIsolationModeTokenVaultV1, createPOLIsolationModeVaultFactory } from './berachain-ecosystem-utils';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import { setupCoreProtocol, setupTestMarket } from 'packages/base/test/utils/setup';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';

describe('POLIsolationModeWrapperUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let factory: POLIsolationModeVaultFactory;
  let dToken: DolomiteERC4626;
  let registry: BerachainRewardsRegistry;

  let proxy: POLIsolationModeWrapperUpgradeableProxy;
  let wrapper: POLIsolationModeWrapperTraderV2;
  let wrapperImpl: POLIsolationModeWrapperTraderV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });
    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI);
    await setupTestMarket(core, factory, true);

    wrapperImpl = await createContractWithAbi<POLIsolationModeWrapperTraderV2>(
      POLIsolationModeWrapperTraderV2__factory.abi,
      POLIsolationModeWrapperTraderV2__factory.bytecode,
      [registry.address, core.dolomiteMargin.address],
    );
    await registry.connect(core.governance).ownerSetPolWrapperTrader(wrapperImpl.address);

    const calldata = await wrapperImpl.populateTransaction.initialize(
      factory.address,
    );
    proxy = await createContractWithAbi<POLIsolationModeWrapperUpgradeableProxy>(
      POLIsolationModeWrapperUpgradeableProxy__factory.abi,
      POLIsolationModeWrapperUpgradeableProxy__factory.bytecode,
      [registry.address, calldata.data!],
    );
    wrapper = POLIsolationModeWrapperTraderV2__factory.connect(proxy.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      expect(await wrapper.token()).to.eq(factory.address);
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await proxy.implementation()).to.eq(wrapperImpl.address);
    });
  });
});
