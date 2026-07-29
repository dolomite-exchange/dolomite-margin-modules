import {
  Network,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { IERC20__factory } from '@dolomite-exchange/modules-base/src/types';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { IERC20Metadata__factory } from '../src/types';

describe('oracle script', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 23_858_500,
      network: Network.Berachain,
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('script', () => {
    it('should work normally', async () => {
      const numberOfMarkets = (await core.dolomiteMargin.getNumMarkets()).toNumber();
      const chronicleOracleAddress = core.chroniclePriceOracleV3.address.toLowerCase();

      for (let marketId = 0; marketId < numberOfMarkets; marketId += 1) {
        const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
        const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
        const [symbol, oracleInfos] = await Promise.all([
          token.symbol(),
          core.oracleAggregatorV2.getOraclesByToken(tokenAddress),
        ]);

        console.log(`Market ${marketId}: ${symbol} (${tokenAddress})`);
        oracleInfos.forEach((oracleInfo, index) => {
          const isChronicle = oracleInfo.oracle.toLowerCase() === chronicleOracleAddress;
          const chronicleMarker = isChronicle ? ' [CHRONICLE]' : '';
          console.log(
            `  Oracle ${index}: ${oracleInfo.oracle}${chronicleMarker}`
            + ` | Pair: ${oracleInfo.tokenPair} | Weight: ${oracleInfo.weight.toString()}`,
          );
        });
        console.log();
      }
    });
  });
});
