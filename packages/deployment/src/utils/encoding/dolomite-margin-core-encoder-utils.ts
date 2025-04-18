import { BigNumber, BigNumberish, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IDolomiteInterestSetter, IERC20__factory, IERC20Metadata__factory } from '../../../../base/src/types';
import {
  AccountRiskOverrideCategory,
  AccountRiskOverrideRiskFeature,
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  SingleCollateralWithStrictDebtParams,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../base/src/utils/constructors/dolomite';
import {
  BYTES_EMPTY,
  NetworkType,
  NetworkTypeForDolomiteV2,
  ONE_ETH_BI,
} from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { EncodedTransaction } from '../dry-run-utils';
import {
  getFormattedTokenName,
  isValidAmountForCapForToken,
  prettyPrintEncodedDataWithTypeSafety,
} from './base-encoder-utils';

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

export async function encodeSetGlobalOperatorIfNecessary<T extends NetworkType>(
  core: CoreProtocolType<T>,
  address: string | { address: string },
  isGlobalOperator: boolean,
): Promise<EncodedTransaction[]> {
  const transactions = [];
  const operatorAddress = typeof address === 'string' ? address : address.address;
  if (isGlobalOperator !== (await core.dolomiteMargin.getIsGlobalOperator(operatorAddress))) {
    transactions.push(await encodeSetGlobalOperator(core, address, isGlobalOperator));
  }

  return transactions;
}

export async function encodeSetSupplyCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: BigNumberish,
): Promise<EncodedTransaction> {
  const token = IERC20__factory.connect(await core.dolomiteMargin.getMarketTokenAddress(marketId), core.hhUser1);
  if (!(await isValidAmountForCapForToken(token, amount))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${amount.toString()}`));
  }

  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return prettyPrintEncodedDataWithTypeSafety(core, { dolomite: core.dolomiteMargin }, 'dolomite', 'ownerSetMaxWei', [
      marketId,
      amount,
    ]);
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxSupplyWei',
    [marketId, amount],
  );
}

/**
 * Expands the number of decimals for `amount` by deciphering the number decimals the market ID has
 */
export async function encodeSetSupplyCapWithMagic<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: number,
): Promise<EncodedTransaction> {
  const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
  const decimals = await IERC20Metadata__factory.connect(tokenAddress, core.hhUser1).decimals();
  const actualAmount = ethers.utils.parseUnits(amount.toString(), decimals);
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return prettyPrintEncodedDataWithTypeSafety(core, { dolomite: core.dolomiteMargin }, 'dolomite', 'ownerSetMaxWei', [
      marketId,
      actualAmount,
    ]);
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxSupplyWei',
    [marketId, actualAmount],
  );
}

export async function encodeSetBorrowCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: BigNumberish,
): Promise<EncodedTransaction> {
  const token = IERC20__factory.connect(await core.dolomiteMargin.getMarketTokenAddress(marketId), core.hhUser1);
  if (!(await isValidAmountForCapForToken(token, amount))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${amount.toString()}`));
  }

  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return Promise.reject(new Error('Invalid Dolomite version!'));
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxBorrowWei',
    [marketId, amount],
  );
}

/**
 * Expands the number of decimals for `amount` by deciphering the number decimals the market ID has
 */
export async function encodeSetBorrowCapWithMagic<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  amount: number,
): Promise<EncodedTransaction> {
  const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
  const decimals = await IERC20Metadata__factory.connect(tokenAddress, core.hhUser1).decimals();
  const actualAmount = ethers.utils.parseUnits(amount.toString(), decimals);

  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    return Promise.reject(new Error('Invalid Dolomite version!'));
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMaxBorrowWei',
    [marketId, actualAmount],
  );
}

let baseCollateralization: BigNumber | undefined;

export async function encodeSetMinCollateralization<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  collateralization: TargetCollateralization,
): Promise<EncodedTransaction> {
  if (!baseCollateralization) {
    baseCollateralization = (await core.dolomiteMargin.getMarginRatio()).value.add(ONE_ETH_BI);
  }

  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetMarginPremium',
    [marketId, { value: getMarginPremiumForTargetCollateralization(baseCollateralization, collateralization) }],
  );
}

let baseLiquidationPenalty: BigNumber | undefined;

export async function encodeSetLiquidationPenalty<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  penalty: TargetLiquidationPenalty,
): Promise<EncodedTransaction> {
  if (!baseLiquidationPenalty) {
    baseLiquidationPenalty = (await core.dolomiteMargin.getLiquidationSpread()).value;
  }

  if ('ownerSetSpreadPremium' in core.dolomiteMargin) {
    return prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetSpreadPremium',
      [marketId, { value: getLiquidationPremiumForTargetLiquidationPenalty(baseLiquidationPenalty, penalty) }],
    );
  }
  if ('ownerSetLiquidationSpreadPremium' in core.dolomiteMargin) {
    return prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetLiquidationSpreadPremium',
      [marketId, { value: getLiquidationPremiumForTargetLiquidationPenalty(baseLiquidationPenalty, penalty) }],
    );
  }

  return Promise.reject('Invalid method name for setting liquidation penalty');
}

export async function encodeSetInterestSetter<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  setter: IDolomiteInterestSetter,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetInterestSetter',
    [marketId, setter.address],
  );
}

export async function encodeSetEarningsRateOverride<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  override: BigNumberish,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetEarningsRateOverride',
    [marketId, { value: override }],
  );
}

export async function encodeSetIsCollateralOnly<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  isCollateralOnly: boolean,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomite: core.dolomiteMargin },
    'dolomite',
    'ownerSetIsClosing',
    [marketId, isCollateralOnly],
  );
}

export async function encodeSetAccountRiskOverrideCategoryByMarketId<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  category: AccountRiskOverrideCategory,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteAccountRiskOverrideSetter: core.dolomiteAccountRiskOverrideSetter },
    'dolomiteAccountRiskOverrideSetter',
    'ownerSetCategoryByMarketId',
    [marketId, category],
  );
}

export async function encodeSetAccountRiskOverrideCategorySettings<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  category: AccountRiskOverrideCategory,
  collateralization: TargetCollateralization,
  liquidationPenalty: TargetLiquidationPenalty,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteAccountRiskOverrideSetter: core.dolomiteAccountRiskOverrideSetter },
    'dolomiteAccountRiskOverrideSetter',
    'ownerSetCategoryParam',
    [category, { value: parseEther(collateralization).sub(ONE_ETH_BI) }, { value: parseEther(liquidationPenalty) }],
  );
}

export async function encodeRemoveAllRiskFeaturesByMarketId<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteAccountRiskOverrideSetter: core.dolomiteAccountRiskOverrideSetter },
    'dolomiteAccountRiskOverrideSetter',
    'ownerSetRiskFeatureByMarketId',
    [marketId, AccountRiskOverrideRiskFeature.NONE, BYTES_EMPTY],
  );
}

export async function encodeSetIsBorrowOnly<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  isBorrowOnly: boolean,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteAccountRiskOverrideSetter: core.dolomiteAccountRiskOverrideSetter },
    'dolomiteAccountRiskOverrideSetter',
    'ownerSetRiskFeatureByMarketId',
    [
      marketId,
      isBorrowOnly ? AccountRiskOverrideRiskFeature.BORROW_ONLY : AccountRiskOverrideRiskFeature.NONE,
      BYTES_EMPTY,
    ],
  );
}

interface SingleCollateralWithStrictDebtParamsForEncoding {
  debtMarketIds: BigNumberish[];
  marginRatioOverride: { value: BigNumberish };
  liquidationRewardOverride: { value: BigNumberish };
}

export async function encodeSetSingleCollateralWithStrictDebtByMarketId<T extends NetworkTypeForDolomiteV2>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  params: SingleCollateralWithStrictDebtParams[],
): Promise<EncodedTransaction> {
  const mappedParams = params.map<SingleCollateralWithStrictDebtParamsForEncoding>((p) => ({
    debtMarketIds: [...p.debtMarketIds].sort((a, b) => BigNumber.from(a).toNumber() - BigNumber.from(b).toNumber()),
    marginRatioOverride: { value: parseEther(p.marginRatioOverride).sub(ONE_ETH_BI) },
    liquidationRewardOverride: { value: parseEther(p.liquidationRewardOverride) },
  }));
  const decimalType = 'tuple(uint256 value)';
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteAccountRiskOverrideSetter: core.dolomiteAccountRiskOverrideSetter },
    'dolomiteAccountRiskOverrideSetter',
    'ownerSetRiskFeatureByMarketId',
    [
      marketId,
      AccountRiskOverrideRiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
      ethers.utils.defaultAbiCoder.encode(
        [
          `tuple(uint256[] debtMarketIds, ${decimalType} marginRatioOverride, ${decimalType} liquidationRewardOverride)[]`,
        ],
        [mappedParams],
      ),
    ],
  );
}
