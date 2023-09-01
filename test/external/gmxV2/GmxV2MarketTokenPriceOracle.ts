import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { GmxRegistryV2, GmxV2IsolationModeVaultFactory, GmxV2MarketTokenPriceOracle } from 'src/types';
import { Network } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { createGmxRegistryV2, createGmxV2IsolationModeTokenVaultV1, createGmxV2IsolationModeVaultFactory, createGmxV2MarketTokenPriceOracle } from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'test/utils/setup';

describe('GmxV2MarketTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmPriceOracle: GmxV2MarketTokenPriceOracle;
  let gmxRegistryV2: GmxRegistryV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let marketId: BigNumberish;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });

    gmxRegistryV2 = await createGmxRegistryV2(core);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
    factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxRegistryV2,
        [],
        [],
        core.gmxEcosystem!.gmxEthUsdMarketToken,
        userVaultImplementation
    );

    gmPriceOracle = await createGmxV2MarketTokenPriceOracle(core, factory, gmxRegistryV2);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, gmPriceOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
        expect(await gmPriceOracle.DGM_ETH_USD()).to.eq(factory.address);
        expect(await gmPriceOracle.REGISTRY()).to.eq(gmxRegistryV2.address);
        expect(await gmPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions', async () => {
        await gmPriceOracle.getPrice(factory.address);
    });
  });
});
