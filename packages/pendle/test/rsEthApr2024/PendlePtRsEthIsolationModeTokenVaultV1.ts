import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { getTWAPPriceOracleV2ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { expect } from 'chai';
import { RS_ETH_CAMELOT_POOL_MAP } from 'packages/base/src/utils/constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { IAlgebraV3Pool__factory, TWAPPriceOracleV2, TWAPPriceOracleV2__factory } from 'packages/oracles/src/types';
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
  createPendlePtRsEthPriceOracle,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtRsEthApr2024IsolationModeTokenVaultV1', () => {
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
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    const underlyingToken = core.tokens.rsEth!;
    const tokenPair = IAlgebraV3Pool__factory.connect(
      RS_ETH_CAMELOT_POOL_MAP[Network.ArbitrumOne]!,
      core.hhUser1,
    );
    const twapPriceOracle = await createContractWithAbi<TWAPPriceOracleV2>(
      TWAPPriceOracleV2__factory.abi,
      TWAPPriceOracleV2__factory.bytecode,
      getTWAPPriceOracleV2ConstructorParams(core, core.tokens.rsEth, tokenPair),
    );
    const rsEthMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, core.tokens.rsEth, false, twapPriceOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(rsEthMarketId, twapPriceOracle.address);
    underlyingPtToken = core.pendleEcosystem!.rsEthApr2024.ptRsEthToken.connect(core.hhUser1);

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthApr2024.rsEthMarket,
      core.pendleEcosystem!.rsEthApr2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingPtToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtRsEthPriceOracle(core, factory, pendleRegistry);

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

    it('should work when owner pauses syRsEth', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const syRsEth = core.pendleEcosystem!.syRsEthToken;
      const owner = await impersonate(await syRsEth.owner(), true);
      await syRsEth.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
