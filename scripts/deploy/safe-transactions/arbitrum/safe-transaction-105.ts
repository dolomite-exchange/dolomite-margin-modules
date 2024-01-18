import { BigNumber } from 'ethers';
import { IDolomiteInterestSetter__factory, IDolomitePriceOracle__factory } from '../../../../src/types';
import { getOwnerAddMarketParameters } from '../../../../packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../deploy-utils';

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

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    getOwnerAddMarketParameters(
      core.tokens.nativeUsdc!,
      usdcPriceOracle,
      usdcInterestSetter,
      ZERO_BI,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetMaxWei',
    [core.marketIds.dPtGlp!, BigNumber.from(1_000_000).mul(BigNumber.from(10).pow(18))],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
