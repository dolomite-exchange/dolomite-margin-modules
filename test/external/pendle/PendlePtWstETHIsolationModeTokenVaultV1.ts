import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IPendlePtToken,
  IPendleSyToken__factory,
  IPlutusVaultGLPFarm,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtWstETHIsolationModeTokenVaultV1,
  PendlePtWstETHIsolationModeUnwrapperTraderV2,
  PendlePtWstETHIsolationModeVaultFactory,
  PendlePtWstETHIsolationModeWrapperTraderV2,
  PendlePtWstETHPriceOracle,
  PendleWstETHRegistry,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createPendlePtWstETHIsolationModeTokenVaultV1,
  createPendlePtWstETHIsolationModeUnwrapperTraderV2,
  createPendlePtWstETHIsolationModeVaultFactory,
  createPendlePtWstETHIsolationModeWrapperTraderV2,
  createPendleWstETHPriceOracle,
  createPendleWstETHRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';

describe('PendlePtWstETHIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendlePtToken;
  let pendleRegistry: PendleWstETHRegistry;
  let unwrapper: PendlePtWstETHIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtWstETHIsolationModeWrapperTraderV2;
  let priceOracle: PendlePtWstETHPriceOracle;
  let factory: PendlePtWstETHIsolationModeVaultFactory;
  let vault: PendlePtWstETHIsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.pendleEcosystem!.ptWstEth2024Token.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtWstETHIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleWstETHRegistry(core);
    factory = await createPendlePtWstETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtWstETHIsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtWstETHIsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendleWstETHPriceOracle(core, factory, pendleRegistry);

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
      const syWstEth = IPendleSyToken__factory.connect(await pendleRegistry.syWstEthToken(), core.hhUser1);
      const owner = await impersonate(await syWstEth.owner(), true);
      await syWstEth.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
