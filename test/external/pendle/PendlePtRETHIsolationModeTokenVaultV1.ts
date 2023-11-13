import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IPendlePtToken,
  IPendleSyToken__factory,
  IPlutusVaultGLPFarm,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtRETHIsolationModeTokenVaultV1,
  PendlePtRETHIsolationModeTokenVaultV1__factory,
  PendlePtRETHIsolationModeUnwrapperTraderV2,
  PendlePtRETHIsolationModeVaultFactory,
  PendlePtRETHIsolationModeWrapperTraderV2,
  PendlePtRETHPriceOracle,
  PendleRETHRegistry,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createPendlePtRETHIsolationModeTokenVaultV1,
  createPendlePtRETHIsolationModeUnwrapperTraderV2,
  createPendlePtRETHIsolationModeVaultFactory,
  createPendlePtRETHIsolationModeWrapperTraderV2,
  createPendlePtRETHPriceOracle,
  createPendleRETHRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';

describe('PendlePtRETHIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendlePtToken;
  let pendleRegistry: PendleRETHRegistry;
  let unwrapper: PendlePtRETHIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtRETHIsolationModeWrapperTraderV2;
  let priceOracle: PendlePtRETHPriceOracle;
  let factory: PendlePtRETHIsolationModeVaultFactory;
  let vault: PendlePtRETHIsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.pendleEcosystem!.ptRETHToken.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtRETHIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRETHRegistry(core);
    factory = await createPendlePtRETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtRETHIsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtRETHIsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendlePtRETHPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtRETHIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtRETHIsolationModeTokenVaultV1__factory,
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
      const syRETH = IPendleSyToken__factory.connect(await pendleRegistry.syRETHToken(), core.hhUser1);
      const owner = await impersonate(await syRETH.owner(), true);
      await syRETH.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
