import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import {
  IPendlePtToken,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtPriceOracle,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV2,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV2,
  createPendlePtPriceOracle,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtREthJun2025IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingPtToken: IPendlePtToken;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtIsolationModeWrapperTraderV2;
  let priceOracle: PendlePtPriceOracle;
  let factory: PendlePtIsolationModeVaultFactory;
  let vault: PendlePtIsolationModeTokenVaultV1;

  before(async () => {
    const blockNumber = 155_090_000;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    underlyingPtToken = core.pendleEcosystem!.rEthJun2025.ptREthToken.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rEthJun2025.ptREthMarket,
      core.pendleEcosystem!.rEthJun2025.ptOracle,
      core.pendleEcosystem!.syREthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingPtToken,
      userVaultImplementation,
    );
    const underlyingToken = core.tokens.rEth!;
    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtPriceOracle(core, factory, pendleRegistry, core.tokens.rEth!);

    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should work when owner pauses syRETH', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const syREth = core.pendleEcosystem!.syREthToken;
      const owner = await impersonate(await syREth.owner(), true);
      await syREth.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
