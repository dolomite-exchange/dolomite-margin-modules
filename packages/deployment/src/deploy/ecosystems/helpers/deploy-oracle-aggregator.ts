import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { IDolomiteRegistry, IERC20__factory, IERC20Metadata__factory } from 'packages/base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, INVALID_TOKEN_MAP } from 'packages/base/src/utils/constants';
import { NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { DolomiteMargin } from 'packages/base/test/utils/dolomite';
import { TokenInfo } from 'packages/oracles/src';
import { getChainlinkPriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import {
  IChainlinkAggregator__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
} from 'packages/oracles/src/types';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';

export async function deployOracleAggregator<T extends NetworkType>(
  network: T,
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): Promise<OracleAggregatorV2> {
  const tokens = Object.keys(CHAINLINK_PRICE_AGGREGATORS_MAP[network]).map((t) =>
    IERC20__factory.connect(t, dolomiteMargin.signer),
  );

  const aggregators = tokens.map((t) =>
    IChainlinkAggregator__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address]!.aggregatorAddress,
      dolomiteMargin.signer,
    ),
  );
  const decimals = await Promise.all(
    tokens.map((token) => {
      const invalidTokenSettings = INVALID_TOKEN_MAP[network][token.address];
      if (invalidTokenSettings) {
        return Promise.resolve(invalidTokenSettings.decimals);
      }

      return IERC20Metadata__factory.connect(token.address, token.signer).decimals();
    }),
  );
  const tokenPairs = tokens.map((t) =>
    IERC20__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address]!.tokenPairAddress ?? ADDRESS_ZERO,
      dolomiteMargin.signer,
    ),
  );
  const invertPrices = tokens.map(() => false);
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    'ChainlinkPriceOracleV3',
    getChainlinkPriceOracleV3ConstructorParams<T>(tokens, aggregators, invertPrices, dolomiteRegistry, dolomiteMargin),
    getMaxDeploymentVersionNameByDeploymentKey('ChainlinkPriceOracle', 3),
  );

  await deployContractAndSave('ChroniclePriceOracleV3', [[], [], [], dolomiteRegistry.address, dolomiteMargin.address]);

  await deployContractAndSave('RedstonePriceOracleV3', [[], [], [], dolomiteRegistry.address, dolomiteMargin.address]);

  const tokenInfos = tokens.map<TokenInfo>((token, i) => {
    return {
      token: token.address,
      decimals: decimals[i],
      oracleInfos: [
        {
          oracle: chainlinkPriceOracleAddress,
          weight: 100,
          tokenPair: tokenPairs[i].address,
        },
      ],
    };
  });
  const oracleAggregatorAddress = await deployContractAndSave(
    'OracleAggregatorV2',
    [tokenInfos as any[], dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('OracleAggregator', 2),
  );
  return OracleAggregatorV2__factory.connect(oracleAggregatorAddress, dolomiteMargin.signer);
}
