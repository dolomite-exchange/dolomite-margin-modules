import { expect } from 'chai';
import {
  IERC4626,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeWrapperTraderV2,
  JonesUSDCPriceOracle,
  JonesUSDCRegistry,
} from '../src/types';
import { BYTES_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCIsolationModeWrapperTraderV2,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from './jones';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { createRoleAndWhitelistTrader, TRADER_ROLE } from './jones-utils';

describe('JonesUSDCIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let unwrapperForLiquidation: JonesUSDCIsolationModeUnwrapperTraderV2;
  let wrapper: JonesUSDCIsolationModeWrapperTraderV2;
  let priceOracle: JonesUSDCPriceOracle;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let vault: JonesUSDCIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.jonesEcosystem!.jUSDC.connect(core.hhUser1);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapperForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      jonesUSDCRegistry,
      factory,
    );
    const unwrapperForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(core, jonesUSDCRegistry, factory);
    await jonesUSDCRegistry.initializeUnwrapperTraders(unwrapperForLiquidation.address, unwrapperForZap.address);
    wrapper = await createJonesUSDCIsolationModeWrapperTraderV2(core, jonesUSDCRegistry, factory);
    priceOracle = await createJonesUSDCPriceOracle(core, jonesUSDCRegistry, factory);

    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapperForLiquidation.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV1>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await createRoleAndWhitelistTrader(core, unwrapperForLiquidation, wrapper);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await vault.registry()).to.equal(jonesUSDCRegistry.address);
    });
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

    it('should be paused when router is paused', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      await core.jonesEcosystem!.glpVaultRouter.connect(core.jonesEcosystem!.admin).toggleEmergencyPause();

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
      expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.true;
      expect(await core.jonesEcosystem!.whitelistController.getUserRole(unwrapperForLiquidation.address))
        .to
        .eq(TRADER_ROLE);
      expect(
        await core.jonesEcosystem!.whitelistController.isWhitelistedContract(unwrapperForLiquidation.address),
      ).to.be.true;
    });

    it('should be paused when redemption bypass time is not active', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const whitelistOwner = await impersonate(await core.jonesEcosystem!.whitelistController.owner());
      await core.jonesEcosystem!.whitelistController.connect(whitelistOwner)
        .removeUserFromRole(unwrapperForLiquidation.address);

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
      expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.false;
      expect(await core.jonesEcosystem!.whitelistController.getUserRole(unwrapperForLiquidation.address))
        .to
        .eq(BYTES_ZERO);
      expect(
        await core.jonesEcosystem!.whitelistController.isWhitelistedContract(unwrapperForLiquidation.address),
      ).to.be.true;
    });

    it('should be paused when unwrapper is not whitelisted', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const whitelistOwner = await impersonate(await core.jonesEcosystem!.whitelistController.owner());
      await core.jonesEcosystem!.whitelistController.connect(whitelistOwner)
        .removeFromWhitelistContract(unwrapperForLiquidation.address);

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
      expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.false;
      expect(await core.jonesEcosystem!.whitelistController.getUserRole(unwrapperForLiquidation.address))
        .to
        .eq(TRADER_ROLE);
      expect(
        await core.jonesEcosystem!.whitelistController.isWhitelistedContract(unwrapperForLiquidation.address),
      ).to.be.false;
    });

    it(
      'should be paused when redemption bypass time is not active or router is paused or not whitelisted',
      async () => {
        expect(await vault.isExternalRedemptionPaused()).to.be.false;

        const whitelistOwner = await impersonate(await core.jonesEcosystem!.whitelistController.owner());
        await core.jonesEcosystem!.whitelistController.connect(whitelistOwner)
          .removeUserFromRole(unwrapperForLiquidation.address);
        await core.jonesEcosystem!.whitelistController.connect(whitelistOwner)
          .removeFromWhitelistContract(unwrapperForLiquidation.address);
        await core.jonesEcosystem!.glpVaultRouter.connect(core.jonesEcosystem!.admin).toggleEmergencyPause();

        expect(await vault.isExternalRedemptionPaused()).to.be.true;
        expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.true;
        expect(await core.jonesEcosystem!.whitelistController.getUserRole(unwrapperForLiquidation.address))
          .to
          .eq(BYTES_ZERO);
        expect(
          await core.jonesEcosystem!.whitelistController.isWhitelistedContract(unwrapperForLiquidation.address),
        ).to.be.false;
      },
    );
  });
});
