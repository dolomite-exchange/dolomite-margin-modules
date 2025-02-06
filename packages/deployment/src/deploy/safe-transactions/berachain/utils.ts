import { BigNumberish } from 'ethers';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '../../../../../base/src/types';
import { TargetCollateralization, TargetLiquidationPenalty } from '../../../../../base/src/utils/constructors/dolomite';
import { ADDRESS_ZERO, ZERO_BI } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from '../../../../../base/test/utils/core-protocols/core-protocol-berachain';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodeAddMarket } from '../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import ModuleDeployments from '../../deployments.json';

async function encodeTestOracle(
  token: IERC20,
  price: BigNumberish,
  core: CoreProtocolBerachain,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracle__factory.connect(
    ModuleDeployments.TestPriceOracle[core.network].address,
    core.hhUser1,
  );

  let decimals: number;
  try {
    decimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  } catch (e) {
    return Promise.reject(new Error(`Could not get decimals for ${token.address}`));
  }

  return [
    await prettyPrintEncodedDataWithTypeSafety(core, { testPriceOracle }, 'testPriceOracle', 'setPrice', [
      token.address,
      price,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: decimals,
          oracleInfos: [
            {
              oracle: testPriceOracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeSimpleBoycoListing(
  core: CoreProtocolBerachain,
  token: IERC20,
  price: BigNumberish,
): Promise<EncodedTransaction[]> {
  return [
    ...(await encodeTestOracle(token, price, core)),
    ...(await prettyPrintEncodeAddMarket(
      core,
      token,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      true,
    )),
  ];
}
