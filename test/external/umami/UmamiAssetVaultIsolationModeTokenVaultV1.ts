import { expect } from 'chai';
import {
  IUmamiAssetVault,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';

describe('UmamiAssetVaultIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 104861700,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.umamiEcosystem!.umUsdc.connect(core.hhUser1);
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      core.usdc,
      userVaultImplementation,
    );
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await vault.registry()).to.equal(umamiRegistry.address);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should be paused when aggregateVault pauses vault', async () => {
      const admin = await impersonate(await core.umamiEcosystem!.whitelist.aggregateVault(), true);
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      await core.umamiEcosystem!.umUsdc.connect(admin).pauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;

      await core.umamiEcosystem!.umUsdc.connect(admin).unpauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });
  });
});
