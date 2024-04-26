import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { IPlutusVaultGLPFarm } from '@dolomite-exchange/modules-plutus/src/types';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IPendlePtToken,
  IPendleSyToken__factory,
  PendleGLPRegistry,
  PendlePtGLPMar2024IsolationModeTokenVaultV1,
  PendlePtGLPMar2024IsolationModeTokenVaultV1__factory,
  PendlePtGLPMar2024IsolationModeUnwrapperTraderV2,
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PendlePtGLPMar2024IsolationModeWrapperTraderV2,
  PendlePtGLPPriceOracle,
} from '../../src/types';
import {
  createPendleGLPRegistry,
  createPendlePtGLPMar2024IsolationModeTokenVaultV1,
  createPendlePtGLPMar2024IsolationModeUnwrapperTraderV2,
  createPendlePtGLPMar2024IsolationModeVaultFactory,
  createPendlePtGLPMar2024IsolationModeWrapperTraderV2,
  createPendlePtGLPPriceOracle,
} from '../pendle-ecosystem-utils';

describe('PendlePtGLPMar2024IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IPendlePtToken;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendlePtGLPMar2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtGLPMar2024IsolationModeWrapperTraderV2;
  let priceOracle: PendlePtGLPPriceOracle;
  let factory: PendlePtGLPMar2024IsolationModeVaultFactory;
  let vault: PendlePtGLPMar2024IsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtGLPMar2024IsolationModeTokenVaultV1();
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendlePtGLPMar2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtGLPMar2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtGLPMar2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendlePtGLPPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLPMar2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtGLPMar2024IsolationModeTokenVaultV1__factory,
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
