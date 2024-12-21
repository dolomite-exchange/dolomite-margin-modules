import { Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';

const BLOCK_NUMBER = 269_186_150; // October 30, 2024 @ 9:48:26 UTC

describe('GmxV2MarketTokenPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: BLOCK_NUMBER,
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Get Open Interest', () => {
    it('should work normally', async () => {
      const gmEth = core.gmxV2Ecosystem.gmTokens.eth;
      const price = await core.oracleAggregatorV2.getPrice(gmEth.indexToken.address);
      const marketProps = {
        indexToken: gmEth.indexToken.address,
        longToken: gmEth.longToken.address,
        marketToken: gmEth.marketToken.address,
        shortToken: gmEth.shortToken.address,
      };
      const priceProps = {
        min: price.value.div('1000000'),
        max: price.value.div('1000000'),
      };
      // 3302391925588705126433952
      // 2001519975564574808875167
      const longOi = await core.gmxV2Ecosystem.gmxReader.getOpenInterestWithPnl(
        core.gmxV2Ecosystem.gmxDataStore.address,
        marketProps,
        priceProps,
        true,
        true,
      );
      const shortOi = await core.gmxV2Ecosystem.gmxReader.getOpenInterestWithPnl(
        core.gmxV2Ecosystem.gmxDataStore.address,
        marketProps,
        priceProps,
        false,
        true,
      );

      console.log('OI:', longOi.toString(), shortOi.toString());
    });
  });
});
