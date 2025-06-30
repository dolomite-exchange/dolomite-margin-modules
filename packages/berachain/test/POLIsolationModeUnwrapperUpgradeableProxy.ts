import { expect } from 'chai';
import { DolomiteERC4626, DolomiteERC4626__factory } from 'packages/base/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6 } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol, setupTestMarket } from 'packages/base/test/utils/setup';
import {
  BerachainRewardsRegistry,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeUnwrapperTraderV2__factory,
  POLIsolationModeUnwrapperUpgradeableProxy,
  POLIsolationModeUnwrapperUpgradeableProxy__factory,
  POLIsolationModeVaultFactory,
  POLIsolationModeWrapperUpgradeableProxy,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory,
  createPolLiquidatorProxy,
} from './berachain-ecosystem-utils';

describe('POLIsolationModeUnwrapperUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let factory: POLIsolationModeVaultFactory;
  let dToken: DolomiteERC4626;
  let registry: BerachainRewardsRegistry;

  let proxy: POLIsolationModeWrapperUpgradeableProxy;
  let unwrapper: POLIsolationModeUnwrapperTraderV2;
  let unwrapperImpl: POLIsolationModeUnwrapperTraderV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });
    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const liquidatorProxyV6 = await createLiquidatorProxyV6(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV6);
    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI);
    await setupTestMarket(core, factory, true);

    unwrapperImpl = await createContractWithAbi<POLIsolationModeUnwrapperTraderV2>(
      POLIsolationModeUnwrapperTraderV2__factory.abi,
      POLIsolationModeUnwrapperTraderV2__factory.bytecode,
      [registry.address, core.dolomiteMargin.address],
    );
    await registry.connect(core.governance).ownerSetPolUnwrapperTrader(unwrapperImpl.address);

    const calldata = await unwrapperImpl.populateTransaction.initialize(factory.address);
    proxy = await createContractWithAbi<POLIsolationModeUnwrapperUpgradeableProxy>(
      POLIsolationModeUnwrapperUpgradeableProxy__factory.abi,
      POLIsolationModeUnwrapperUpgradeableProxy__factory.bytecode,
      [registry.address, calldata.data!],
    );
    unwrapper = POLIsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await proxy.implementation()).to.eq(unwrapperImpl.address);
    });
  });
});
