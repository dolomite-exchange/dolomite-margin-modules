import {
  IDolomiteInterestSetter__factory,
  IDolomitePriceOracle__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adds native USDC as a supported network on Arbitrum
 * - Increases the PT-GLP supply cap to 1M units
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const usdcPriceOracle = IDolomitePriceOracle__factory.connect(
    await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.usdc),
    core.hhUser1,
  );
  const usdcInterestSetter = IDolomiteInterestSetter__factory.connect(
    await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usdc),
    core.hhUser1,
  );

  await encodeAddMarket(
    core,
    core.tokens.nativeUsdc!,
    usdcPriceOracle,
    usdcInterestSetter,
    TargetCollateralization.Base,
    TargetLiquidationPenalty.Base,
    ZERO_BI,
    ZERO_BI,
    false,
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetMaxWei',
    [core.marketIds.dPtGlpMar2024!, BigNumber.from(1_000_000).mul(BigNumber.from(10).pow(18))],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
