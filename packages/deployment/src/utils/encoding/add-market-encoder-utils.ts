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
import {
  ADDRESS_ZERO,
  DolomiteNetwork,
  Network,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../../../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GmToken } from '../../../../base/test/utils/ecosystem-utils/gmx';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { BerachainPOLSystem } from '../deploy-utils';
import { EncodedTransaction } from '../dry-run-utils';
import {
  getFormattedTokenName,
  isValidAmountForCapForToken,
  prettyPrintEncodedDataWithTypeSafety,
} from './base-encoder-utils';

export interface AddMarketOptions {
  skipAmountValidation?: boolean;
  decimals?: number;
  skipEncodeLiquidatorWhitelist?: boolean;
  enablePartialLiquidation?: boolean;
}

export interface AddIsolationModeMarketOptions extends AddMarketOptions {
  /**
   * Converts to concat to the default batch
   */
  additionalConverters?: BaseContract[];
  /**
   * Converters to exclude from the default batch
   */
  sliceConverters?: BaseContract[];
  whitelistedLiquidatorAddress?: string;
}

export async function encodeAddIsolationModeMarket<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddIsolationModeMarketOptions = {},
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = await encodeAddMarket(
    core,
    marketId,
    IERC20__factory.connect(factory.address, factory.signer),
    oracle,
    core.interestSetters.alwaysZeroInterestSetter,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    ZERO_BI,
    true,
    ZERO_BI,
    {
      ...options,
      enablePartialLiquidation: false,
    },
  );

  const converters = (
    [
      unwrapper,
      wrapper,
      core.borrowPositionRouter,
      core.depositWithdrawalRouter,
      core.genericTraderRouter,
    ] as BaseContract[]
  )
    .concat(options.additionalConverters ?? [])
    .filter((c) => !options.sliceConverters?.some((s) => s.address === c.address))
    .map((c) => c.address);

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerInitialize', [converters]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, options.whitelistedLiquidatorAddress ?? core.liquidatorProxyV6.address],
    ),
  );

  return transactions;
}

export async function encodeAddPOLIsolationModeMarket<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  polSystem: BerachainPOLSystem,
  oracle: IDolomitePriceOracle,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddIsolationModeMarketOptions = {},
): Promise<EncodedTransaction[]> {
  if (core.network !== Network.Berachain) {
    return Promise.reject(new Error('Core protocol is not Berachain'));
  }

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: polSystem.factory.address,
          decimals: 18,
          oracleInfos: [
            {
              oracle: polSystem.oracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),

    ...(await encodeAddIsolationModeMarket(
      core,
      polSystem.factory as any as IIsolationModeVaultFactory,
      oracle,
      polSystem.unwrapper,
      polSystem.wrapper,
      marketId,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      {
        ...options,
        whitelistedLiquidatorAddress: core.berachainRewardsEcosystem.live.polLiquidatorProxy.address,
        sliceConverters: [core.depositWithdrawalRouter],
      },
    )),
  ];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [polSystem.unwrapper.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [polSystem.wrapper.address, true],
    ),
  );

  return transactions;
}

export async function encodeAddAsyncIsolationModeMarket<T extends DolomiteNetwork>(
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
  const transactions: EncodedTransaction[] = await encodeAddIsolationModeMarket(
    core,
    factory,
    oracle,
    unwrapper,
    wrapper,
    marketId,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    options,
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

export async function encodeAddMarket<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  token: IERC20,
  oracle: IDolomitePriceOracle,
  interestSetter: IDolomiteInterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish,
  isCollateralOnly: boolean,
  earningsRateOverride: BigNumberish = ZERO_BI,
  options: AddMarketOptions = {
    enablePartialLiquidation: true,
  },
): Promise<EncodedTransaction[]> {
  if (!options.skipAmountValidation && !(await isValidAmountForCapForToken(token, maxSupplyWei))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${maxSupplyWei.toString()}`));
  }
  if (!options.skipAmountValidation && !(await isValidAmountForCapForToken(token, maxBorrowWei))) {
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
  if (options.enablePartialLiquidation) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'liquidatorProxyV6',
        'ownerSetMarketToPartialLiquidationSupported',
        [[marketId], [true]] as any,
      ),
    );
  }
  return transactions;
}
