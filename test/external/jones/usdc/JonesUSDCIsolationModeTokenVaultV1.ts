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
} from '../../../../src/types';
import { Network } from '../../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../../utils';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCIsolationModeWrapperTraderV2,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../../utils/setup';
import { createRoleAndWhitelistTrader } from './jones-utils';

describe('JonesUSDCIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2;
  let wrapper: JonesUSDCIsolationModeWrapperTraderV2;
  let priceOracle: JonesUSDCPriceOracle;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let vault: JonesUSDCIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.jonesEcosystem!.jUSDC.connect(core.hhUser1);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createJonesUSDCIsolationModeUnwrapperTraderV2(core, jonesUSDCRegistry, factory);
    await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapper.address);
    wrapper = await createJonesUSDCIsolationModeWrapperTraderV2(core, jonesUSDCRegistry, factory);
    priceOracle = await createJonesUSDCPriceOracle(core, jonesUSDCRegistry, factory);

    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV1>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await createRoleAndWhitelistTrader(core, unwrapper, wrapper);

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

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should be paused when router is paused', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      await core.jonesEcosystem!.glpVaultRouter.connect(core.jonesEcosystem!.admin).toggleEmergencyPause();

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
      expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.true;
    });

    it('should be paused when redemption bypass time is not active', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const whitelistOwner = await impersonate(await core.jonesEcosystem!.whitelistController.owner());
      await core.jonesEcosystem!.whitelistController.connect(whitelistOwner).removeUserFromRole(unwrapper.address);

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });

    it('should be paused when redemption bypass time is not active or router is paused', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const whitelistOwner = await impersonate(await core.jonesEcosystem!.whitelistController.owner());
      await core.jonesEcosystem!.whitelistController.connect(whitelistOwner).removeUserFromRole(unwrapper.address);
      await core.jonesEcosystem!.glpVaultRouter.connect(core.jonesEcosystem!.admin).toggleEmergencyPause();

      expect(await vault.isExternalRedemptionPaused()).to.be.true;
      expect(await core.jonesEcosystem!.glpVaultRouter.emergencyPaused()).to.be.true;
      expect(await core.jonesEcosystem!.whitelistController.isWhitelistedContract(unwrapper.address)).to.be.false;
    });
  });
});
