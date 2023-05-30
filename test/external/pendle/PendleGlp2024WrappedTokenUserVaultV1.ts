import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IERC4626,
  IPendleSyToken__factory,
  IPlutusVaultGLPFarm,
  PendlePtGLP2024Registry,
  PendlePtGLP2024WrappedTokenUserVaultFactory,
  PendlePtGLP2024WrappedTokenUserVaultV1,
  PendlePtGLP2024WrappedTokenUserVaultV1__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPUnwrapperTrader,
  PendlePtGLPWrapperTrader,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import {
  createPendlePtGLP2024PriceOracle,
  createPendlePtGLP2024Registry,
  createPendlePtGLP2024UnwrapperTrader,
  createPendlePtGLP2024WrappedTokenUserVaultFactory,
  createPendlePtGLP2024WrappedTokenUserVaultV1,
  createPendlePtGLP2024WrapperTrader,
} from '../../utils/wrapped-token-utils/pendle';

describe('PendlePtGLP2024WrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let pendleRegistry: PendlePtGLP2024Registry;
  let unwrapper: PendlePtGLPUnwrapperTrader;
  let wrapper: PendlePtGLPWrapperTrader;
  let priceOracle: PendlePtGLPPriceOracle;
  let factory: PendlePtGLP2024WrappedTokenUserVaultFactory;
  let vault: PendlePtGLP2024WrappedTokenUserVaultV1;
  let underlyingMarketId: BigNumber;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 96118000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtGLP2024WrappedTokenUserVaultV1();
    pendleRegistry = await createPendlePtGLP2024Registry(core);
    factory = await createPendlePtGLP2024WrappedTokenUserVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtGLP2024UnwrapperTrader(core, pendleRegistry);
    wrapper = await createPendlePtGLP2024WrapperTrader(core, pendleRegistry);
    priceOracle = await createPendlePtGLP2024PriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLP2024WrappedTokenUserVaultV1>(
      vaultAddress,
      PendlePtGLP2024WrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
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
