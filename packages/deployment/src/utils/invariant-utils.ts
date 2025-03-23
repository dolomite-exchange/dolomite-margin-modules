import { BigNumber, BigNumberish, ethers } from 'ethers';
import { formatUnits, parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IDolomiteInterestSetter, IERC20, IERC20Metadata__factory } from '../../../base/src/types';
import { IDolomiteStructs } from '../../../base/src/types/contracts/protocol/interfaces/IDolomiteMargin';
import { INVALID_TOKEN_MAP } from '../../../base/src/utils/constants';
import {
  AccountRiskOverrideCategory,
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../base/src/utils/constructors/dolomite';
import { NetworkType, ONE_ETH_BI } from '../../../base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from '../../../base/test/utils/core-protocols/core-protocol-berachain';
import { CoreProtocolType } from '../../../base/test/utils/setup';
import { readDeploymentFile } from './deploy-utils';

export async function printPriceForVisualCheck<T extends NetworkType>(core: CoreProtocolType<T>, token: IERC20) {
  const meta = IERC20Metadata__factory.connect(token.address, token.provider);
  const invalidToken = INVALID_TOKEN_MAP[core.network][token.address];
  const symbol = invalidToken ? invalidToken.symbol : await meta.symbol();
  const decimals = invalidToken ? invalidToken.decimals : await meta.decimals();
  const price = await core.oracleAggregatorV2.getPrice(token.address);
  console.log(`\tPrice for ${symbol}:`, formatUnits(price.value, 36 - decimals));
}

export async function printRiskDataVisualCheck<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
) {
  const marginRatio = (await core.dolomiteMargin.getMarginRatio()).value.add(ONE_ETH_BI);
  const liquidationRatio = (await core.dolomiteMargin.getLiquidationSpread()).value;
  const market = await core.dolomiteMargin.getMarket(marketId);
  const meta = IERC20Metadata__factory.connect(market.token, core.hhUser1);
  const symbol = await meta.symbol();
  const decimals = await meta.decimals();

  const totalRepeater = 80;
  const repeater = Math.floor((totalRepeater - symbol.length - 2) / 2);
  console.log('='.repeat(totalRepeater));
  console.log(`${'='.repeat(repeater)} ${symbol} ${'='.repeat(repeater)}`);
  console.log('='.repeat(totalRepeater));
  if ('maxBorrowWei' in market) {
    const disabledText = market.isClosing ? ' (disabled)' : '';
    console.log({
      minCollateralization: convertPremiumToDisplayNumber(marginRatio, market.marginPremium),
      liquidationPenalty: convertPremiumToDisplayNumber(liquidationRatio, market.liquidationSpreadPremium),
      supplyCap: convertWeiToDisplayNumber(market.maxSupplyWei.value, decimals, symbol),
      borrowCap: convertWeiToDisplayNumber(market.maxBorrowWei.value, decimals, symbol).concat(disabledText),
      interestSetter: convertInterestSetterToDisplayName(core, market.interestSetter),
      isBorrowingEnabled: !market.isClosing,
    });
  } else {
    console.log({
      minCollateralization: convertPremiumToDisplayNumber(marginRatio, market.marginPremium),
      liquidationPenalty: convertPremiumToDisplayNumber(liquidationRatio, market.spreadPremium),
      supplyCap: convertWeiToDisplayNumber(market.maxWei.value, decimals, symbol),
      interestSetter: convertInterestSetterToDisplayName(core, market.interestSetter),
      isBorrowingEnabled: !market.isClosing,
    });
  }
  console.log('='.repeat(totalRepeater));
  console.log();
}

function convertPremiumToDisplayNumber(base: BigNumber, premium: IDolomiteStructs.DecimalStruct) {
  const appliedPremium = base.mul(ONE_ETH_BI.add(premium.value)).div(ONE_ETH_BI);
  return `${ethers.utils.formatEther(appliedPremium.mul(100))}%`;
}

function convertWeiToDisplayNumber(value: BigNumberish, decimals: number, symbol: string) {
  return `${Number(ethers.utils.formatUnits(value, decimals)).toLocaleString()} ${symbol}`;
}

function convertInterestSetterToDisplayName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  interestSetter: string,
): string {
  const deployments = readDeploymentFile();
  for (const displayName in deployments) {
    const value = deployments[displayName][core.network];
    if (value && value.address && value.address.toLowerCase() === interestSetter.toLowerCase()) {
      return displayName;
    }
  }

  throw new Error(`Could not find display name for interest setter: ${interestSetter}`);
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

export async function checkMarketId<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  token: IERC20,
) {
  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketTokenAddress(marketId)) === token.address,
    `Invalid market ID for ${marketId}`,
  );
}

export async function checkSupplyCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedAmount: BigNumberish,
) {
  const errorMessage = `Expected market [${marketId}] to have a supply cap of ${expectedAmount.toString()}`;
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    assertHardhatInvariant(
      (await core.dolomiteMargin.getMarketMaxWei(marketId)).value.eq(expectedAmount),
      errorMessage,
    );
    return;
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketMaxSupplyWei(marketId)).value.eq(expectedAmount),
    errorMessage,
  );
}

export async function checkBorrowCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedAmount: BigNumberish,
) {
  const errorMessage = `Expected market [${marketId}] to have a borrow cap of ${expectedAmount.toString()}`;
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    assertHardhatInvariant(
      (await core.dolomiteMargin.getMarketMaxWei(marketId)).value.eq(expectedAmount),
      errorMessage,
    );
    return;
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketMaxBorrowWei(marketId)).value.eq(expectedAmount),
    errorMessage,
  );
}

let baseCollateralization: BigNumber | undefined;

export async function checkMinCollateralization<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  collateralization: TargetCollateralization,
) {
  if (!baseCollateralization) {
    baseCollateralization = (await core.dolomiteMargin.getMarginRatio()).value.add(ONE_ETH_BI);
  }

  const marginPremium = (await core.dolomiteMargin.getMarketMarginPremium(marketId)).value;
  assertHardhatInvariant(
    getMarginPremiumForTargetCollateralization(baseCollateralization, collateralization).eq(marginPremium),
    `Expected market [${marketId}] to have a target collateralization of ${collateralization}`,
  );
}

let baseLiquidationPenalty: BigNumber | undefined;

export async function checkLiquidationPenalty<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  liquidationPenalty: TargetLiquidationPenalty,
) {
  if (!baseLiquidationPenalty) {
    baseLiquidationPenalty = (await core.dolomiteMargin.getLiquidationSpread()).value;
  }

  const liquidationPremium = (await core.dolomiteMargin.getMarketSpreadPremium(marketId)).value;
  assertHardhatInvariant(
    getLiquidationPremiumForTargetLiquidationPenalty(baseLiquidationPenalty, liquidationPenalty).eq(liquidationPremium),
    `Expected market [${marketId}] to have a target liquidation penalty of ${liquidationPenalty}`,
  );
}

export async function checkIsCollateralOnly<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedCollateralOnly: boolean,
) {
  let errorMessage: string;
  if (expectedCollateralOnly) {
    errorMessage = `Expected market [${marketId}] to be collateral only`;
  } else {
    errorMessage = `Expected market [${marketId}] to be borrowable`;
  }
  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketIsClosing(marketId)) === expectedCollateralOnly,
    errorMessage,
  );
}

export async function checkInterestSetter<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedInterestSetter: IDolomiteInterestSetter,
) {
  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketInterestSetter(marketId)) === expectedInterestSetter.address,
    `Expected market [${marketId}] to have interest setter ${expectedInterestSetter.address}`,
  );
}

export async function checkAccountRiskOverrideCategory<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  category: AccountRiskOverrideCategory,
) {
  assertHardhatInvariant(
    (await core.dolomiteAccountRiskOverrideSetter.getCategoryByMarketId(marketId)) === category,
    `Expected market [${marketId}] to have risk category ${category}`,
  );
}

export async function checkAccountRiskOverrideCategorySettings<T extends NetworkType>(
  core: CoreProtocolType<T>,
  category: AccountRiskOverrideCategory,
  expectedCollateralization: TargetCollateralization,
  expectedLiquidationPenalty: TargetLiquidationPenalty,
) {
  const param = await core.dolomiteAccountRiskOverrideSetter.getCategoryParamByCategory(category);
  assertHardhatInvariant(
    param.marginRatioOverride.value.eq(parseEther(expectedCollateralization).sub(ONE_ETH_BI)),
    `Expected category [${category}] to have margin ratio of ${expectedCollateralization}`,
  );
  assertHardhatInvariant(
    param.liquidationRewardOverride.value.eq(parseEther(expectedLiquidationPenalty)),
    `Expected category [${category}] to have liquidation penalty of ${expectedLiquidationPenalty}`,
  );
}
