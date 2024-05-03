import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
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
import {
  getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle,
  getRedstonePriceOracleV2ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV2,
  ChainlinkPriceOracleV2__factory,
  RedstonePriceOracleV2,
  RedstonePriceOracleV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { expect } from 'chai';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from 'packages/base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
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
  createPendlePtEEthPriceOracle,
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV2,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtEEthApr2024IsolationModeTokenVaultV1', () => {
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
      blockNumber: 206_135_947,
      network: Network.ArbitrumOne,
    });

    const underlyingToken = core.tokens.weEth!;
    underlyingPtToken = core.pendleEcosystem!.weEthApr2024.ptWeEthToken.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthApr2024.weEthMarket,
      core.pendleEcosystem!.weEthApr2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingPtToken,
      userVaultImplementation,
    );
    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);

    const wethAggregator = await core.chainlinkPriceOracleOld!.getAggregatorByToken(core.tokens.weth.address);
    const redstoneAggregatorMap = REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne];
    const weEthAggregator = redstoneAggregatorMap[core.tokens.weEth.address].aggregatorAddress;
    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV2>(
      RedstonePriceOracleV2__factory.abi,
      RedstonePriceOracleV2__factory.bytecode,
      await getRedstonePriceOracleV2ConstructorParams(
        [core.tokens.weth, underlyingToken],
        [wethAggregator, weEthAggregator],
        [ADDRESS_ZERO, core.tokens.weth.address],
        [false, false],
        core,
      ),
    )).connect(core.governance);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    const chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV2>(
      ChainlinkPriceOracleV2__factory.abi,
      ChainlinkPriceOracleV2__factory.bytecode,
      await getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle(core),
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      chainlinkOracle.address,
    );
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleTokenWithBypass(
      underlyingToken.address,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address].aggregatorAddress,
      ADDRESS_ZERO,
      true,
    );
    priceOracle = await createPendlePtEEthPriceOracle(core, factory, pendleRegistry);
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

    it('should work when owner pauses syWstEth', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const syWeEth = core.pendleEcosystem!.syWeEthToken;
      const owner = await impersonate(await syWeEth.owner(), true);
      await syWeEth.connect(owner).pause();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
