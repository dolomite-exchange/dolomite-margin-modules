import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { GmxRegistryV2, GmxV2IsolationModeUnwrapperTraderV2, GmxV2IsolationModeVaultFactory, GmxV2IsolationModeWrapperTraderV2, GmxV2MarketTokenPriceOracle } from 'src/types';
import { Network } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectThrow } from 'test/utils/assertions';
import { createGmxRegistryV2, createGmxV2IsolationModeTokenVaultV1, createGmxV2IsolationModeUnwrapperTraderV2, createGmxV2IsolationModeVaultFactory, createGmxV2IsolationModeWrapperTraderV2, createGmxV2MarketTokenPriceOracle } from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'test/utils/setup';

const GM_ETH_USD_PRICE = BigNumber.from('924171896095781105283809017999');
const blockNumber = 128276157;

describe('GmxV2MarketTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let allowableMarketIds: BigNumberish[];
  let gmPriceOracle: GmxV2MarketTokenPriceOracle;
  let gmxRegistryV2: GmxRegistryV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: blockNumber,
      network: Network.ArbitrumOne,
    });
    gmxRegistryV2 = await createGmxRegistryV2(core);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    gmPriceOracle = await createGmxV2MarketTokenPriceOracle(core, factory, gmxRegistryV2);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, gmPriceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
        expect(await gmPriceOracle.DGM_TOKEN()).to.eq(factory.address);
        expect(await gmPriceOracle.REGISTRY()).to.eq(gmxRegistryV2.address);
        expect(await gmPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe.only('#getPrice', () => {
    // @follow-up This one fails sometimes. Price seems to always be one of two
    it('returns the correct value under normal conditions', async () => {
      expect((await gmPriceOracle.getPrice(factory.address)).value).to.eq(GM_ETH_USD_PRICE);
    });

    it('should fail when token sent is not the DGM token', async () => {
      await expectThrow(
        gmPriceOracle.getPrice(ADDRESSES.ZERO),
        `GmxV2MarketTokenPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        gmPriceOracle.getPrice(core.tokens.usdc.address),
        `GmxV2MarketTokenPriceOracle: Invalid token <${core.tokens.usdc.address.toLowerCase()}>`,
      );
    });

    it('should fail when GM token is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        gmPriceOracle.getPrice(factory.address),
        'GmxV2MarketTokenPriceOracle: gmToken cannot be borrowable',
      );
    });
  });
});
