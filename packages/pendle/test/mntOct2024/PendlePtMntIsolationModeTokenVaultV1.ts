import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
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
  PendlePtPriceOracleV2,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV3,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV3,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

describe('PendlePtMntOct2024IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let underlyingPtToken: IPendlePtToken;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtIsolationModeWrapperTraderV2;
  let priceOracle: PendlePtPriceOracleV2;
  let factory: PendlePtIsolationModeVaultFactory;
  let vault: PendlePtIsolationModeTokenVaultV1;

  before(async () => {
    const blockNumber = 68_670_570;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.Mantle,
    });

    underlyingPtToken = core.pendleEcosystem!.mntOct2024.ptMntToken.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.mntOct2024.mntMarket,
      core.pendleEcosystem!.mntOct2024.ptOracle,
      core.pendleEcosystem!.mntOct2024.syMntToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingPtToken,
      userVaultImplementation,
    );
    const underlyingToken = core.tokens.wmnt!;
    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV3(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV3(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);

    const tokenInfo = {
      oracleInfos: [
        { oracle: priceOracle.address, tokenPair: underlyingToken.address, weight: 100 }
      ],
      decimals: 18,
      token: factory.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);

    await setupTestMarket(core, factory, true, priceOracle);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

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
      const syToken = core.pendleEcosystem!.mntOct2024.syMntToken;
      const owner = await impersonate(await syToken.owner(), true);
      await syToken.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
