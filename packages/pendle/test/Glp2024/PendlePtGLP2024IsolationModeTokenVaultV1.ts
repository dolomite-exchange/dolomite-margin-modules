import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IPendlePtToken,
  IPendleSyToken__factory,
  IPlutusVaultGLPFarm,
  PendleGLPRegistry,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLPPriceOracle,
} from '../../../../src/types';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../../../packages/base/test/utils';
import {
  createPendleGLPRegistry,
  createPendlePtGLP2024IsolationModeTokenVaultV1,
  createPendlePtGLP2024IsolationModeUnwrapperTraderV2,
  createPendlePtGLP2024IsolationModeVaultFactory,
  createPendlePtGLP2024IsolationModeWrapperTraderV2,
  createPendlePtGLPPriceOracle,
} from '@dolomite-exchange/modules-pendle/test/pendle';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../../../packages/base/test/utils/setup';

describe('PendlePtGLP2024IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendlePtToken;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendlePtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtGLP2024IsolationModeWrapperTraderV2;
  let priceOracle: PendlePtGLPPriceOracle;
  let factory: PendlePtGLP2024IsolationModeVaultFactory;
  let vault: PendlePtGLP2024IsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtGLP2024IsolationModeTokenVaultV1();
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendlePtGLP2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendlePtGLPPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtGLP2024IsolationModeTokenVaultV1__factory,
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

    it('should work when owner pauses syGLP', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
      const owner = await impersonate(await syGlp.owner(), true);
      await syGlp.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
