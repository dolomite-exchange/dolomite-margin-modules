import { BigNumberish } from 'ethers';
import { CoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { IAlgebraV3Pool, IERC20 } from '@dolomite-exchange/modules-base/src/types';

export async function getChainlinkPriceOracleParams(
  core: CoreProtocol,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  const oldPriceOracle = core.chainlinkPriceOracleOld!;
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const tokenDecimals: number[] = [];
  const tokenPairs: string[] = [];
  const marketsLength = (await core.dolomiteMargin.getNumMarkets()).toNumber();
  for (let i = 0; i < marketsLength; i++) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(i);
    const priceOracle = await core.dolomiteMargin.getMarketPriceOracle(i);
    if (priceOracle === oldPriceOracle.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.tokenToAggregatorMap(token));
      tokenDecimals.push(await oldPriceOracle.tokenToDecimalsMap(token));
      tokenPairs.push(await oldPriceOracle.tokenToPairingMap(token));
    }
  }
  return [tokens, aggregators, tokenDecimals, tokenPairs, core.dolomiteMargin.address];
}

export function getTWAPPriceOracleConstructorParams(
  core: CoreProtocol,
  token: IERC20,
  tokenPairs: IAlgebraV3Pool[],
): any[] {
  return [token.address, tokenPairs.map(pair => pair.address), core.dolomiteMargin.address];
}
