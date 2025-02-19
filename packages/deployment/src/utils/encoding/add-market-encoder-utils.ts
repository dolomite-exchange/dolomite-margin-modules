import { BaseContract, BigNumberish } from 'ethers';
import { IGlvIsolationModeVaultFactory, IGmxV2IsolationModeVaultFactory } from 'packages/glv/src/types';
import {
  HandlerRegistry,
  IDolomiteInterestSetter,
  IDolomitePriceOracle,
  IERC20,
  IERC20__factory,
  IERC20Metadata__factory,
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeVaultFactory,
  IIsolationModeWrapperTraderV2,
} from '../../../../base/src/types';
import {
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  getOwnerAddMarketParameters,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../base/src/utils/constructors/dolomite';
import { ADDRESS_ZERO, NetworkType, ONE_ETH_BI, ZERO_BI } from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../../../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GmToken } from '../../../../base/test/utils/ecosystem-utils/gmx';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { EncodedTransaction } from '../dry-run-utils';
import { getFormattedTokenName, isValidAmount, prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

export interface AddMarketOptions {
  additionalConverters?: BaseContract[];
  skipAmountValidation?: boolean;
  decimals?: number;
}

export async function encodeAddIsolationModeMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = await encodeAddMarket(
    core,
    IERC20__factory.connect(factory.address, factory.signer),
    oracle,
    core.interestSetters.alwaysZeroInterestSetter,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    ZERO_BI,
    true,
    ZERO_BI,
    options,
  );

  throw new Error('add routers to core object and ownerInitialize!');
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerInitialize', [
      [unwrapper.address, wrapper.address, ...(options.additionalConverters ?? []).map((c) => c.address)],
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4.address],
    ),
  );

  return transactions;
}

export async function encodeAddAsyncIsolationModeMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = await encodeAddMarket(
    core,
    IERC20__factory.connect(factory.address, factory.signer),
    oracle,
    core.interestSetters.alwaysZeroInterestSetter,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    ZERO_BI,
    true,
    ZERO_BI,
    options,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerInitialize', [
      [unwrapper.address, wrapper.address, ...(options.additionalConverters ?? []).map((c) => c.address)],
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4.address],
    ),
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.freezableLiquidatorProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { handlerRegistry },
      'handlerRegistry',
      'ownerSetUnwrapperByToken',
      [factory.address, unwrapper.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { handlerRegistry }, 'handlerRegistry', 'ownerSetWrapperByToken', [
      factory.address,
      wrapper.address,
    ]),
  );

  return transactions;
}

export async function encodeAddGlvMarket(
  core: CoreProtocolArbitrumOne,
  factory: IGlvIsolationModeVaultFactory,
  pairedGmToken: GmToken,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: core.glvEcosystem.live.registry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [await factory.UNDERLYING_TOKEN(), pairedGmToken.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: core.glvEcosystem.live.registry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [await factory.UNDERLYING_TOKEN(), pairedGmToken.marketToken.address],
    ),
    ...(await encodeAddAsyncIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      handlerRegistry,
      marketId,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      options,
    )),
  ];
}

export async function encodeAddGmxV2Market(
  core: CoreProtocolArbitrumOne,
  factory: IGmxV2IsolationModeVaultFactory,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxV2PriceOracle: core.gmxV2Ecosystem.live.priceOracle },
      'gmxV2PriceOracle',
      'ownerSetMarketToken',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          decimals: await IERC20Metadata__factory.connect(factory.address, factory.signer).decimals(),
          token: factory.address,
          oracleInfos: [
            {
              oracle: core.gmxV2Ecosystem.live.priceOracle.address,
              weight: 100,
              tokenPair: ADDRESS_ZERO,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxV2Registry: core.gmxV2Ecosystem.live.registry },
      'gmxV2Registry',
      'ownerSetGmxMarketToIndexToken',
      [await factory.UNDERLYING_TOKEN(), await factory.INDEX_TOKEN()],
    ),
    ...(await encodeAddAsyncIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      handlerRegistry,
      marketId,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      options,
    )),
  ];
}

export async function encodeAddMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
  oracle: IDolomitePriceOracle,
  interestSetter: IDolomiteInterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish,
  isCollateralOnly: boolean,
  earningsRateOverride: BigNumberish = ZERO_BI,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  if (!options.skipAmountValidation && !(await isValidAmount(token, maxSupplyWei))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${maxSupplyWei.toString()}`));
  }
  if (!options.skipAmountValidation && !(await isValidAmount(token, maxBorrowWei))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max borrow wei for ${name}, found: ${maxBorrowWei.toString()}`));
  }

  const baseCollateralization = (await core.dolomiteMargin.getMarginRatio()).value.add(ONE_ETH_BI);
  const baseLiquidationPenalty = (await core.dolomiteMargin.getLiquidationSpread()).value;

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerAddMarket',
      getOwnerAddMarketParameters(
        core,
        token,
        oracle,
        interestSetter,
        getMarginPremiumForTargetCollateralization(baseCollateralization, targetCollateralization),
        getLiquidationPremiumForTargetLiquidationPenalty(baseLiquidationPenalty, targetLiquidationPremium),
        maxSupplyWei,
        maxBorrowWei,
        isCollateralOnly,
        earningsRateOverride,
      ),
    ),
  );
  return transactions;
}
