import { BigNumberish, ethers } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '../../../../../base/src/types';
import { TargetCollateralization, TargetLiquidationPenalty } from '../../../../../base/src/utils/constructors/dolomite';
import { ADDRESS_ZERO, NetworkType, ZERO_BI } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from '../../../../../base/test/utils/core-protocols/core-protocol-berachain';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
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

export async function encodeSetGlobalOperator<T extends NetworkType>(
  core: CoreProtocolType<T>,
  address: string | { address: string },
  isGlobalOperator: boolean,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetGlobalOperator',
    [typeof address === 'string' ? address : address.address, isGlobalOperator],
  );
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

export async function checkMarket(core: CoreProtocolBerachain, marketId: BigNumberish, token: IERC20) {
  let name: string | undefined;
  try {
    const metadata = IERC20Metadata__factory.connect(token.address, token.provider);
    name = await metadata.name();

    const decimals = await metadata.decimals();
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    console.log(`\tPrice for ${name}:`, ethers.utils.formatUnits(price.value, 36 - decimals));
  } catch (e: any) {
    return Promise.reject(new Error(`Could not get price for ${token.address} (${name}) due to error: ${e.message}`));
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketTokenAddress(marketId)) === token.address,
    `Invalid token for ${name}`,
  );
}

export async function checkIsGlobalOperator<T extends NetworkType>(
  core: CoreProtocolType<T>,
  address: string | { address: string },
) {
  const value = typeof address === 'string' ? address : address.address;
  assertHardhatInvariant(
    await core.dolomiteMargin.getIsGlobalOperator(value),
    `Expected ${value} to be global operator`,
  );
}
