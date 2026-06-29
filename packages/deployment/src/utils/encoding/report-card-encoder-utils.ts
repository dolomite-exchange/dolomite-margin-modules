import { BigNumber } from '@dolomite-exchange/dolomite-margin';
import { formatUnits } from 'ethers/lib/utils';
import { PancakeV3PriceOracleWithModifiers } from 'packages/oracles/src/types';
import { DolomiteNetwork, Network } from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../base/test/utils/setup';

const ONE = new BigNumber(1);
const TEN = new BigNumber(10);

export async function encodeReportCard<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  acceptableOracles: { address: string }[],
  twapPriceOracleV3: PancakeV3PriceOracleWithModifiers | undefined,
) {
  const markets = await fetch(`https://api.dolomite.io/tokens/${core.network}`).then((res) => res.json());
  for (const token of markets['tokens']) {
    const decimals = parseInt(token.decimals, 10);
    const factor = TEN.pow(decimals);
    const supplyCap = new BigNumber(token.riskInfo.supplyMaxWei);
    const borrowCap = new BigNumber(token.riskInfo.borrowMaxWei);
    const isCollateralOnly = token.riskInfo.isBorrowingDisabled;
    const isBorrowOnly = token.riskFeature?.feature === 'borrow_only';
    const oracles = await core.oracleAggregatorV2.getOraclesByToken(token.id);

    const stringBuilder = [['\t==================== ', token.symbol, ' ====================']];
    if (!supplyCap.isNaN() && !supplyCap.eq(ONE.div(factor))) {
      stringBuilder.push(['\tSupply cap: ', supplyCap.toFormat(decimals)]);
    }
    if (!isCollateralOnly && !borrowCap.isNaN() && !borrowCap.eq(ONE.div(factor))) {
      stringBuilder.push(['\tBorrow cap: ', borrowCap.toFormat(decimals)]);
    }
    if (!isCollateralOnly && !isBorrowOnly) {
      stringBuilder.push(['\tisCollateralOnly: ', isCollateralOnly]);
    } else if (!isCollateralOnly && isBorrowOnly) {
      stringBuilder.push(['\tisBorrowOnly: ', isBorrowOnly]);
    }
    if (oracles.length !== 1) {
      stringBuilder.push(['\tOracle: ', oracles.map((o) => o.oracle).join(', ')]);
    } else if (
      !acceptableOracles.map(o => o.address).includes(oracles[0].oracle)
    ) {
      stringBuilder.push(['\tOracle: ', oracles[0].oracle]);
    } else if (twapPriceOracleV3 && oracles[0].oracle === twapPriceOracleV3.address) {
      const settings = await twapPriceOracleV3.getTokenInfo(token.id);
      const results = {
        currentPrice: formatUnits((await twapPriceOracleV3.getPrice(token.id)).value, 36 - settings.decimals),
        pair: settings.pair,
        observationInterval: settings.observationInterval,
        minPrice: formatUnits(settings.minPrice, 36 - settings.decimals),
        maxPrice: formatUnits(settings.maxPrice, 36 - settings.decimals),
      };
      stringBuilder.push(['\tTWAP Oracle Settings: ', JSON.stringify(results, null, '\t\t').replace('}', '\t}')]);
    }

    if (stringBuilder.length > 1) {
      console.log(stringBuilder.map((row) => row.join('')).join('\n'));
      console.log('');
    }
  }
}
