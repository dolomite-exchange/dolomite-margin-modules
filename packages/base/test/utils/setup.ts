import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import Deployments, * as deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  ChroniclePriceOracleV3__factory,
  IChainlinkAutomationRegistry__factory,
  IChainlinkPriceOracleV3__factory,
  OkxPriceOracleV3__factory,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumber as ZapBigNumber } from '@dolomite-exchange/zap-sdk';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as IGenericTraderProxyV1Json from '@dolomite-margin/deployed-contracts/GenericTraderProxyV1.json';
import * as LiquidatorAssetRegistryJson from '@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json';
import * as LiquidatorProxyV1Json from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json';
import * as LiquidatorProxyV4WithGenericTraderJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV4WithGenericTrader.json';
import { address } from '@dolomite-margin/dist/src';
import { Provider } from '@ethersproject/providers';
import { BaseContract, BigNumberish, ContractInterface, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';
import { IChainlinkPriceOracleV1__factory } from 'packages/oracles/src/types';
import {
  DolomiteERC20__factory,
  DolomiteERC20WithPayable__factory,
  IBorrowPositionProxyV2__factory,
  IDepositWithdrawalProxy__factory,
  IDolomiteAccountRegistry__factory,
  IDolomiteAccountValuesReader__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IDolomiteMarginV2,
  IDolomiteMarginV2__factory,
  IDolomiteMigrator__factory,
  IDolomiteRegistry__factory,
  IERC20,
  IERC20__factory,
  IEventEmitterRegistry__factory,
  IExpiry__factory,
  IExpiryV2__factory,
  IGenericTraderProxyV1__factory,
  ILiquidatorAssetRegistry__factory,
  ILiquidatorProxyV1__factory,
  ILiquidatorProxyV4WithGenericTrader__factory,
  IPartiallyDelayedMultiSig__factory,
  IsolationModeFreezableLiquidatorProxy__factory,
  IWETH__factory,
  RegistryProxy__factory,
} from '../../src/types';
import {
  ARB_MAP,
  CHAINLINK_AUTOMATION_REGISTRY_MAP,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  CHAINLINK_PRICE_ORACLE_V1_MAP,
  D_ARB_MAP,
  D_GM_ARB_MAP,
  D_GM_BTC_MAP,
  D_GM_BTC_SINGLE_SIDED_MAP,
  D_GM_ETH_MAP,
  D_GM_ETH_SINGLE_SIDED_MAP,
  D_GM_LINK_MAP,
  D_GMX_MAP,
  DAI_MAP,
  DFS_GLP_MAP,
  DJ_USDC_V1,
  DJ_USDC_V2,
  DPLV_GLP_MAP,
  DPT_EZ_ETH_JUN_2024_MAP,
  DPT_GLP_MAR_2024_MAP,
  DPT_R_ETH_JUN_2025_MAP,
  DPT_WE_ETH_APR_2024_MAP,
  DPT_WE_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2025_MAP,
  DPX_MAP,
  DYT_GLP_2024_MAP,
  E_ETH_MAP,
  EZ_ETH_MAP,
  FRAX_MAP,
  GMX_BTC_PLACEHOLDER_MAP,
  GMX_MAP,
  GRAI_MAP,
  GRAIL_MAP,
  JONES_MAP,
  LINK_MAP,
  MAGIC_GLP_MAP,
  MAGIC_MAP,
  MATIC_MAP,
  METH_MAP,
  MIM_MAP,
  NATIVE_USDC_MAP,
  PENDLE_MAP,
  PREMIA_MAP,
  R_ETH_MAP,
  RDNT_MAP,
  RS_ETH_MAP,
  S_GLP_MAP,
  SIZE_MAP,
  SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
  ST_ETH_MAP,
  UNI_MAP,
  USDC_MAP,
  USDM_MAP,
  USDT_MAP,
  USDY_MAP,
  WBTC_MAP,
  WE_ETH_MAP,
  WETH_MAP,
  WMNT_MAP,
  WOKB_MAP,
  WST_ETH_MAP,
  XAI_MAP,
} from '../../src/utils/constants';
import {
  ADDRESS_ZERO,
  Network,
  NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP,
  NetworkType,
} from '../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';
import {
  CoreProtocolAbstract,
  CoreProtocolParams,
  LibraryMaps,
  WETHType,
} from './core-protocols/core-protocol-abstract';
import { CoreProtocolArbitrumOne } from './core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolBase } from './core-protocols/core-protocol-base';
import { CoreProtocolMantle, CoreProtocolParamsMantle } from './core-protocols/core-protocol-mantle';
import { CoreProtocolPolygonZkEvm } from './core-protocols/core-protocol-polygon-zkevm';
import { CoreProtocolXLayer } from './core-protocols/core-protocol-x-layer';
import { DolomiteMargin, Expiry } from './dolomite';
import { createAbraEcosystem } from './ecosystem-utils/abra';
import { createArbEcosystem } from './ecosystem-utils/arb';
import { createCamelotEcosystem } from './ecosystem-utils/camelot';
import { createGmxEcosystem, createGmxEcosystemV2 } from './ecosystem-utils/gmx';
import { createInterestSetters } from './ecosystem-utils/interest-setters';
import { createJonesEcosystem } from './ecosystem-utils/jones';
import {
  createMineralLiquidityMiningEcosystem,
  createOARBLiquidityMiningEcosystem,
} from './ecosystem-utils/liquidity-mining';
import { createOdosEcosystem } from './ecosystem-utils/odos';
import { createOkxEcosystem } from './ecosystem-utils/okx';
import { createParaswapEcosystem } from './ecosystem-utils/paraswap';
import { createPendleEcosystem } from './ecosystem-utils/pendle';
import { createPlutusEcosystem } from './ecosystem-utils/plutus';
import { createPremiaEcosystem } from './ecosystem-utils/premia';
import { createTestEcosystem } from './ecosystem-utils/testers';
import { createUmamiEcosystem } from './ecosystem-utils/umami';
import { impersonate, impersonateOrFallback, resetForkIfPossible } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig<T extends NetworkType> {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  readonly blockNumber: number;
  readonly network: T;
  readonly skipForking?: boolean;
}

export interface CoreProtocolConfigParent<T extends NetworkType> {
  readonly blockNumber: number;
  readonly network: T;
  readonly networkNumber: number;
}

interface CoreProtocolConfigArbitrumOne extends CoreProtocolConfigParent<Network.ArbitrumOne> {
  readonly arbitrumOne: boolean;
}

interface CoreProtocolConfigBase extends CoreProtocolConfigParent<Network.Base> {
  readonly base: boolean;
}

interface CoreProtocolConfigMantle extends CoreProtocolConfigParent<Network.Mantle> {
  readonly mantle: boolean;
}

interface CoreProtocolConfigPolygonZkEvm extends CoreProtocolConfigParent<Network.PolygonZkEvm> {
  readonly polygonZkEvm: boolean;
}

interface CoreProtocolConfigXLayer extends CoreProtocolConfigParent<Network.XLayer> {
  readonly xLayer: boolean;
}

export type CoreProtocolConfig<T extends NetworkType> = T extends Network.ArbitrumOne
  ? CoreProtocolConfigArbitrumOne
  : T extends Network.Base
  ? CoreProtocolConfigBase
  : T extends Network.Mantle
  ? CoreProtocolConfigMantle
  : T extends Network.PolygonZkEvm
  ? CoreProtocolConfigPolygonZkEvm
  : T extends Network.XLayer
  ? CoreProtocolConfigXLayer
  : never;

export async function disableInterestAccrual<T extends NetworkType>(
  core: CoreProtocolAbstract<T>,
  marketId: BigNumberish,
) {
  return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.interestSetters.alwaysZeroInterestSetter.address);
}

export async function enableInterestAccrual<T extends NetworkType>(
  core: CoreProtocolAbstract<T>,
  marketId: BigNumberish,
) {
  return core.dolomiteMargin.ownerSetInterestSetter(
    marketId,
    core.interestSetters.linearStepFunction8L92UInterestSetter.address,
  );
}

export async function setupWETHBalance<T extends NetworkType>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  if ('deposit' in core.tokens.weth) {
    await core.tokens.weth.connect(signer).deposit({ value: amount });
    await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
  } else if (core.network === Network.Mantle) {
    // TODO:
  } else if (core.network === Network.XLayer) {
    // TODO:
  }
}

export async function setupWMNTBalance(
  core: CoreProtocolParamsMantle,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  await core.tokens.wmnt.connect(signer).deposit({ value: amount });
  await core.tokens.wmnt.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWBTCBalance<T extends NetworkType>(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x078f358208685046a11c85e8ad32895ded33a249'; // Aave Token
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.wbtc.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.wbtc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupARBBalance(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xf3fc178157fb3c87548baa86f9d24ba38e649b58'; // ARB Treasury
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.arb!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.arb!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupDAIBalance(
  core: { tokens: { dai: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x489ee077994b6658eafa855c308275ead8097c4a'; // GMX Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.dai.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.dai.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupNativeUSDCBalance(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x3dd1d15b3c78d6acfd75a254e857cbe5b9ff0af2'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.nativeUsdc!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.nativeUsdc!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance<T extends NetworkType>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupGMBalance(
  core: CoreProtocolArbitrumOne,
  gmToken: IGmxMarketToken,
  signer: { address: string },
  amount: BigNumberish,
  spender?: { address: string },
) {
  const controller = await impersonate(core.gmxEcosystemV2!.gmxExchangeRouter.address, true);
  await gmToken.connect(controller).mint(signer.address, amount);
  if (signer instanceof SignerWithAddressWithSafety && spender) {
    await gmToken.connect(signer).approve(spender.address, amount);
  }
}

export async function setupGMXBalance(
  core: { tokens: { gmx: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.gmx!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.gmx!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupRsEthBalance(
  core: { tokens: { rsEth: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xf176fb51f4eb826136a54fdc71c50fcd2202e272'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.rsEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.rsEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupRETHBalance(
  core: { tokens: { rEth: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.rEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.rEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWeEthBalance(
  core: { tokens: { weEth: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xa6c895eb332e91c5b3d00b7baeeaae478cc502da'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.weEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.weEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWstETHBalance(
  core: { tokens: { wstEth: IERC20 } },
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.wstEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.wstEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export function setupUserVaultProxy<T extends BaseContract>(
  vault: address,
  factoryInterface: { abi: ContractInterface },
  signer?: SignerWithAddressWithSafety,
): T {
  return new BaseContract(vault, factoryInterface.abi, signer) as T;
}

export function getDefaultCoreProtocolConfig<T extends NetworkType>(network: T): CoreProtocolConfig<T> {
  return getCoreProtocolConfig(network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network]);
}

function getCoreProtocolConfig<T extends NetworkType>(network: T, blockNumber: number): CoreProtocolConfig<T> {
  if (network === Network.ArbitrumOne) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      arbitrumOne: true,
    } as CoreProtocolConfigArbitrumOne as any;
  }

  if (network === Network.Base) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      base: true,
    } as CoreProtocolConfigBase as any;
  }

  if (network === Network.Mantle) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      mantle: true,
    } as CoreProtocolConfigMantle as any;
  }

  if (network === Network.PolygonZkEvm) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      polygonZkEvm: true,
    } as CoreProtocolConfigPolygonZkEvm as any;
  }

  if (network === Network.XLayer) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      xLayer: true,
    } as CoreProtocolConfigXLayer as any;
  }

  throw new Error(`Invalid network, found: ${network}`);
}

export function getDefaultCoreProtocolConfigForGmxV2(): CoreProtocolConfig<Network.ArbitrumOne> {
  return {
    network: Network.ArbitrumOne,
    networkNumber: parseInt(Network.ArbitrumOne, 10),
    blockNumber: 164_788_000,
    arbitrumOne: true,
  };
}

export type CoreProtocolType<T extends NetworkType> = T extends Network.ArbitrumOne
  ? CoreProtocolArbitrumOne
  : T extends Network.Base
  ? CoreProtocolBase
  : T extends Network.Mantle
  ? CoreProtocolMantle
  : T extends Network.PolygonZkEvm
  ? CoreProtocolPolygonZkEvm
  : T extends Network.XLayer
  ? CoreProtocolXLayer
  : never;

export function getDolomiteMarginContract<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): DolomiteMargin<T> {
  return (
    config.network === Network.ArbitrumOne
      ? IDolomiteMargin__factory.connect(DolomiteMarginJson.networks[config.network].address, signer)
      : IDolomiteMarginV2__factory.connect(DolomiteMarginJson.networks[config.network].address, signer)
  ) as DolomiteMargin<T>;
}

export function getExpiryContract<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): Expiry<T> {
  return (
    config.network === Network.ArbitrumOne
      ? IExpiry__factory.connect(ExpiryJson.networks[config.network].address, signer)
      : IExpiryV2__factory.connect(ExpiryJson.networks[config.network].address, signer)
  ) as Expiry<T>;
}

export function getWethContract<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): WETHType<T> {
  return (
    config.network === Network.ArbitrumOne || config.network === Network.Base || config.network === Network.PolygonZkEvm
      ? IWETH__factory.connect(WETH_MAP[config.network].address, signer)
      : IERC20__factory.connect(WETH_MAP[config.network].address, signer)
  ) as WETHType<T>;
}

export async function setupCoreProtocol<T extends NetworkType>(
  config: Readonly<CoreProtocolSetupConfig<T>>,
): Promise<CoreProtocolType<T>> {
  if (!config.skipForking) {
    await resetForkIfPossible(config.blockNumber, config.network);
  }

  const dolomiteMarginAddress = DolomiteMarginJson.networks[config.network].address;
  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await Promise.all(
    (await ethers.getSigners()).map((s) => SignerWithAddressWithSafety.create(s.address)),
  );
  const governance: SignerWithAddressWithSafety = await impersonateOrFallback(
    await IDolomiteMargin__factory.connect(dolomiteMarginAddress, hhUser1).owner(),
    true,
    hhUser1,
  );

  const dolomiteMargin = getDolomiteMarginContract<T>(config, governance);

  const borrowPositionProxyV2 = IBorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
  );

  const chainlinkPriceOracleV1 = getContract(
    CHAINLINK_PRICE_ORACLE_V1_MAP[config.network],
    IChainlinkPriceOracleV1__factory.connect,
    governance,
  );
  const chainlinkPriceOracleV3 = getContract(
    Deployments.ChainlinkPriceOracleV3[config.network]?.address,
    IChainlinkPriceOracleV3__factory.connect,
    governance,
  );

  const delayedMultiSig = IPartiallyDelayedMultiSig__factory.connect(
    await dolomiteMargin.connect(hhUser1).owner(),
    governance,
  );

  const depositWithdrawalProxy = IDepositWithdrawalProxy__factory.connect(
    DepositWithdrawalProxyJson.networks[config.network].address,
    governance,
  );

  const dolomiteRegistry = IDolomiteRegistry__factory.connect(
    Deployments.DolomiteRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteRegistryProxy = RegistryProxy__factory.connect(
    Deployments.DolomiteRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRegistry = IDolomiteAccountRegistry__factory.connect(
    Deployments.DolomiteAccountRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRegistryProxy = RegistryProxy__factory.connect(
    Deployments.DolomiteAccountRegistryProxy[config.network].address,
    governance,
  );

  const eventEmitterRegistry = getContract(
    Deployments.EventEmitterRegistryProxy[config.network].address,
    IEventEmitterRegistry__factory.connect,
    governance,
  );

  const eventEmitterRegistryProxy = getContract(
    Deployments.EventEmitterRegistryProxy[config.network].address,
    RegistryProxy__factory.connect,
    governance,
  );

  const expiry = getExpiryContract<T>(config, governance);

  const freezableLiquidatorProxy = IsolationModeFreezableLiquidatorProxy__factory.connect(
    getMaxDeploymentVersionAddressByDeploymentKey('IsolationModeFreezableLiquidatorProxy', config.network),
    governance,
  );

  const genericTraderProxy = getContract(
    IGenericTraderProxyV1Json.networks[config.network].address,
    IGenericTraderProxyV1__factory.connect,
    governance,
  );

  const interestSetters = await createInterestSetters(config.network, hhUser1);

  const liquidatorAssetRegistry = ILiquidatorAssetRegistry__factory.connect(
    LiquidatorAssetRegistryJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1 = ILiquidatorProxyV1__factory.connect(
    LiquidatorProxyV1Json.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV4 = getContract(
    LiquidatorProxyV4WithGenericTraderJson.networks[config.network].address,
    ILiquidatorProxyV4WithGenericTrader__factory.connect,
    governance,
  );

  const oracleAggregatorV2 = getContract(
    Deployments.OracleAggregatorV2[config.network].address,
    OracleAggregatorV2__factory.connect,
    governance,
  );

  const testEcosystem = await createTestEcosystem(dolomiteMargin, governance);

  const libraries: LibraryMaps = {
    tokenVaultActionsImpl: createTokenVaultActionsLibraries(config),
    unwrapperTraderImpl: createAsyncUnwrapperImplLibraries(config),
    wrapperTraderImpl: createAsyncWrapperImplLibraries(config),
  };

  const coreProtocolParams: CoreProtocolParams<T> = {
    borrowPositionProxyV2,
    chainlinkPriceOracleV1,
    chainlinkPriceOracleV3,
    delayedMultiSig,
    depositWithdrawalProxy,
    dolomiteMargin,
    dolomiteRegistry,
    dolomiteRegistryProxy,
    dolomiteAccountRegistry,
    dolomiteAccountRegistryProxy,
    eventEmitterRegistry,
    eventEmitterRegistryProxy,
    expiry,
    freezableLiquidatorProxy,
    genericTraderProxy,
    governance,
    interestSetters,
    libraries,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV4,
    oracleAggregatorV2,
    testEcosystem,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    apiTokens: {
      usdc: {
        marketId: new ZapBigNumber(USDC_MAP[config.network].marketId),
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        tokenAddress: USDC_MAP[config.network].address,
      },
      weth: {
        marketId: new ZapBigNumber(WETH_MAP[config.network].marketId),
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        tokenAddress: WETH_MAP[config.network].address,
      },
    },
    config: getCoreProtocolConfig(config.network, config.blockNumber),
    constants: {
      slippageToleranceForPauseSentinel: SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
      chainlinkAggregators: CHAINLINK_PRICE_AGGREGATORS_MAP[config.network],
    },
    marketIds: {
      usdc: USDC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
      stablecoins: [USDC_MAP[config.network].marketId],
    },
    tokens: {
      usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
      weth: getWethContract(config, hhUser1),
      stablecoins: [IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1)],
    },
  };

  if (config.network === Network.ArbitrumOne) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.ArbitrumOne>;
    return new CoreProtocolArbitrumOne(coreProtocolParams as CoreProtocolParams<Network.ArbitrumOne>, {
      chainlinkPriceOracleV1,
      chainlinkPriceOracleV3,
      abraEcosystem: await createAbraEcosystem(typedConfig.network, hhUser1),
      arbEcosystem: await createArbEcosystem(typedConfig.network, hhUser1),
      camelotEcosystem: await createCamelotEcosystem(typedConfig.network, hhUser1),
      chainlinkAutomationRegistry: IChainlinkAutomationRegistry__factory.connect(
        CHAINLINK_AUTOMATION_REGISTRY_MAP[typedConfig.network],
        governance,
      ),
      chroniclePriceOracleV3: ChroniclePriceOracleV3__factory.connect(
        Deployments.ChroniclePriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      dolomiteAccountValuesReader: IDolomiteAccountValuesReader__factory.connect(
        CoreDeployments.AccountValuesReader[typedConfig.network].address,
        hhUser1,
      ),
      dolomiteMigrator: IDolomiteMigrator__factory.connect(
        Deployments.DolomiteMigratorV2[typedConfig.network].address,
        hhUser1,
      ),
      dTokens: {
        usdc: DolomiteERC20__factory.connect(Deployments.DolomiteUsdcToken[typedConfig.network].address, hhUser1),
        wbtc: DolomiteERC20__factory.connect(Deployments.DolomiteWbtcToken[typedConfig.network].address, hhUser1),
        weth: DolomiteERC20WithPayable__factory.connect(
          Deployments.DolomiteWethToken[typedConfig.network].address,
          hhUser1,
        ),
        usdcProxy: RegistryProxy__factory.connect(Deployments.DolomiteUsdcToken[typedConfig.network].address, hhUser1),
        wbtcProxy: RegistryProxy__factory.connect(Deployments.DolomiteWbtcToken[typedConfig.network].address, hhUser1),
        wethProxy: RegistryProxy__factory.connect(Deployments.DolomiteWethToken[typedConfig.network].address, hhUser1),
      },
      gmxEcosystem: await createGmxEcosystem(typedConfig.network, hhUser1),
      gmxEcosystemV2: await createGmxEcosystemV2(typedConfig.network, hhUser1),
      jonesEcosystem: await createJonesEcosystem(typedConfig.network, hhUser1),
      mineralLiquidityMiningEcosystem: await createMineralLiquidityMiningEcosystem(typedConfig.network, hhUser1),
      oArbLiquidityMiningEcosystem: await createOARBLiquidityMiningEcosystem(typedConfig.network, hhUser1),
      odosEcosystem: await createOdosEcosystem(typedConfig.network, hhUser1),
      paraswapEcosystem: await createParaswapEcosystem(typedConfig.network, hhUser1),
      pendleEcosystem: await createPendleEcosystem(typedConfig.network, hhUser1),
      plutusEcosystem: await createPlutusEcosystem(typedConfig.network, hhUser1),
      premiaEcosystem: await createPremiaEcosystem(typedConfig.network, hhUser1),
      redstonePriceOracleV3: RedstonePriceOracleV3__factory.connect(
        Deployments.RedstonePriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      umamiEcosystem: await createUmamiEcosystem(typedConfig.network, hhUser1),
      marketIds: {
        ...coreProtocolParams.marketIds,
        arb: ARB_MAP[typedConfig.network].marketId,
        dArb: D_ARB_MAP[typedConfig.network].marketId,
        dfsGlp: DFS_GLP_MAP[typedConfig.network].marketId,
        dGmx: D_GMX_MAP[typedConfig.network].marketId,
        dGmArb: D_GM_ARB_MAP[typedConfig.network].marketId,
        dGmBtc: D_GM_BTC_MAP[typedConfig.network].marketId,
        dGmBtcSingleSided: D_GM_BTC_SINGLE_SIDED_MAP[typedConfig.network].marketId,
        dGmEth: D_GM_ETH_MAP[typedConfig.network].marketId,
        dGmEthSingleSided: D_GM_ETH_SINGLE_SIDED_MAP[typedConfig.network].marketId,
        dGmLink: D_GM_LINK_MAP[typedConfig.network].marketId,
        djUsdcV1: DJ_USDC_V1[typedConfig.network].marketId,
        djUsdcV2: DJ_USDC_V2[typedConfig.network].marketId,
        dplvGlp: DPLV_GLP_MAP[typedConfig.network].marketId,
        dPtEzEthJun2024: DPT_EZ_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtGlpMar2024: DPT_GLP_MAR_2024_MAP[typedConfig.network].marketId,
        dPtREthJun2025: DPT_R_ETH_JUN_2025_MAP[typedConfig.network].marketId,
        dPtWeEthApr2024: DPT_WE_ETH_APR_2024_MAP[typedConfig.network].marketId,
        dPtWeEthJun2024: DPT_WE_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtWstEthJun2024: DPT_WST_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtWstEthJun2025: DPT_WST_ETH_JUN_2025_MAP[typedConfig.network].marketId,
        dai: DAI_MAP[typedConfig.network]!.marketId,
        dpx: DPX_MAP[typedConfig.network].marketId,
        dYtGlp: DYT_GLP_2024_MAP[typedConfig.network].marketId,
        ezEth: EZ_ETH_MAP[typedConfig.network].marketId,
        gmx: GMX_MAP[typedConfig.network].marketId,
        grai: GRAI_MAP[typedConfig.network].marketId,
        grail: GRAIL_MAP[typedConfig.network].marketId,
        jones: JONES_MAP[typedConfig.network].marketId,
        link: LINK_MAP[typedConfig.network]!.marketId,
        magic: MAGIC_MAP[typedConfig.network].marketId,
        magicGlp: MAGIC_GLP_MAP[typedConfig.network].marketId,
        mim: MIM_MAP[typedConfig.network].marketId,
        nativeUsdc: NATIVE_USDC_MAP[typedConfig.network].marketId,
        premia: PREMIA_MAP[typedConfig.network].marketId,
        rEth: R_ETH_MAP[typedConfig.network].marketId,
        radiant: RDNT_MAP[typedConfig.network].marketId,
        pendle: PENDLE_MAP[typedConfig.network].marketId,
        sGlp: S_GLP_MAP[typedConfig.network].marketId,
        uni: UNI_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        weEth: WE_ETH_MAP[typedConfig.network].marketId,
        wstEth: WST_ETH_MAP[typedConfig.network].marketId,
        xai: XAI_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          DAI_MAP[typedConfig.network]!.marketId,
          GRAI_MAP[typedConfig.network].marketId,
          MIM_MAP[typedConfig.network].marketId,
          NATIVE_USDC_MAP[typedConfig.network].marketId,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      tokens: {
        ...coreProtocolParams.tokens,
        arb: IERC20__factory.connect(ARB_MAP[typedConfig.network].address, hhUser1),
        dai: IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
        dArb: IERC20__factory.connect(D_ARB_MAP[typedConfig.network].address, hhUser1),
        dfsGlp: IERC20__factory.connect(DFS_GLP_MAP[typedConfig.network].address, hhUser1),
        dGmx: IERC20__factory.connect(D_GMX_MAP[typedConfig.network].address, hhUser1),
        dGmArb: IERC20__factory.connect(D_GM_ARB_MAP[typedConfig.network].address, hhUser1),
        dGmBtc: IERC20__factory.connect(D_GM_BTC_MAP[typedConfig.network].address, hhUser1),
        dGmEth: IERC20__factory.connect(D_GM_ETH_MAP[typedConfig.network].address, hhUser1),
        dGmLink: IERC20__factory.connect(D_GM_LINK_MAP[typedConfig.network].address, hhUser1),
        djUsdcV1: IERC20__factory.connect(DJ_USDC_V1[typedConfig.network].address, hhUser1),
        djUsdcV2: IERC20__factory.connect(DJ_USDC_V2[typedConfig.network].address, hhUser1),
        dPtGlp: IERC20__factory.connect(DPT_GLP_MAR_2024_MAP[typedConfig.network].address, hhUser1),
        dPtREthJun2025: IERC20__factory.connect(DPT_R_ETH_JUN_2025_MAP[typedConfig.network].address, hhUser1),
        dPtWeEthApr2024: IERC20__factory.connect(DPT_WE_ETH_APR_2024_MAP[typedConfig.network].address, hhUser1),
        dPtWstEthJun2024: IERC20__factory.connect(DPT_WST_ETH_JUN_2024_MAP[typedConfig.network].address, hhUser1),
        dPtWstEthJun2025: IERC20__factory.connect(DPT_WST_ETH_JUN_2025_MAP[typedConfig.network].address, hhUser1),
        dpx: IERC20__factory.connect(DPX_MAP[typedConfig.network].address, hhUser1),
        dYtGlp: IERC20__factory.connect(DYT_GLP_2024_MAP[typedConfig.network].address, hhUser1),
        eEth: IERC20__factory.connect(E_ETH_MAP[typedConfig.network].address, hhUser1),
        ezEth: IERC20__factory.connect(EZ_ETH_MAP[typedConfig.network].address, hhUser1),
        frax: IERC20__factory.connect(FRAX_MAP[typedConfig.network].address, hhUser1),
        gmx: IERC20__factory.connect(GMX_MAP[typedConfig.network].address, hhUser1),
        gmxBtc: IERC20__factory.connect(GMX_BTC_PLACEHOLDER_MAP[typedConfig.network].address, hhUser1),
        grai: IERC20__factory.connect(GRAI_MAP[typedConfig.network].address, hhUser1),
        grail: IERC20__factory.connect(GRAIL_MAP[typedConfig.network].address, hhUser1),
        jones: IERC20__factory.connect(JONES_MAP[typedConfig.network].address, hhUser1),
        link: IERC20__factory.connect(LINK_MAP[typedConfig.network]!.address, hhUser1),
        magic: IERC20__factory.connect(MAGIC_MAP[typedConfig.network].address, hhUser1),
        mim: IERC20__factory.connect(MIM_MAP[typedConfig.network].address, hhUser1),
        nativeUsdc: IERC20__factory.connect(NATIVE_USDC_MAP[typedConfig.network].address, hhUser1),
        premia: IERC20__factory.connect(PREMIA_MAP[typedConfig.network].address, hhUser1),
        pendle: IERC20__factory.connect(PENDLE_MAP[typedConfig.network].address, hhUser1),
        rEth: IERC20__factory.connect(R_ETH_MAP[typedConfig.network].address, hhUser1),
        rsEth: IERC20__factory.connect(RS_ETH_MAP[typedConfig.network].address, hhUser1),
        radiant: IERC20__factory.connect(RDNT_MAP[typedConfig.network].address, hhUser1),
        sGlp: IERC20__factory.connect(S_GLP_MAP[typedConfig.network].address, hhUser1),
        size: IERC20__factory.connect(SIZE_MAP[typedConfig.network].address, hhUser1),
        stEth: IERC20__factory.connect(ST_ETH_MAP[typedConfig.network].address, hhUser1),
        uni: IERC20__factory.connect(UNI_MAP[typedConfig.network].address, hhUser1),
        usdm: IERC20__factory.connect(USDM_MAP[typedConfig.network].address, hhUser1),
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        weth: coreProtocolParams.tokens.weth as any,
        weEth: IERC20__factory.connect(WE_ETH_MAP[typedConfig.network].address, hhUser1),
        wstEth: IERC20__factory.connect(WST_ETH_MAP[typedConfig.network].address, hhUser1),
        xai: IERC20__factory.connect(XAI_MAP[typedConfig.network].address, hhUser1),
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
          IERC20__factory.connect(GRAI_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(MIM_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(NATIVE_USDC_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        ],
      },
    }) as any;
  }
  if (config.network === Network.Base) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.Base>;
    return new CoreProtocolBase(coreProtocolParams as CoreProtocolParams<Network.Base>, {
      odosEcosystem: await createOdosEcosystem(typedConfig.network, hhUser1),
      paraswapEcosystem: await createParaswapEcosystem(typedConfig.network, hhUser1),
    }) as any;
  }
  if (config.network === Network.Mantle) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.Mantle>;
    const chroniclePriceOracle = ChroniclePriceOracleV3__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('ChroniclePriceOracle', Network.Mantle, ADDRESS_ZERO),
      hhUser1,
    );
    const redstonePriceOracle = RedstonePriceOracleV3__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('RedstonePriceOracle', Network.Mantle, ADDRESS_ZERO),
      hhUser1,
    );
    return new CoreProtocolMantle(coreProtocolParams as CoreProtocolParams<Network.Mantle>, {
      chroniclePriceOracleV3: chroniclePriceOracle,
      redstonePriceOracleV3: redstonePriceOracle,
      marketIds: {
        ...coreProtocolParams.marketIds,
        meth: METH_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        usdy: USDY_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        wmnt: WMNT_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          USDT_MAP[typedConfig.network].marketId,
          USDY_MAP[typedConfig.network].marketId,
        ],
      },
      odosEcosystem: await createOdosEcosystem(typedConfig.network, hhUser1),
      tokens: {
        ...coreProtocolParams.tokens,
        meth: IERC20__factory.connect(METH_MAP[typedConfig.network].address, hhUser1),
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        usdy: IERC20__factory.connect(USDY_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        wmnt: IWETH__factory.connect(WMNT_MAP[typedConfig.network].address, hhUser1),
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(USDY_MAP[typedConfig.network].address, hhUser1),
        ],
      },
    }) as any;
  }
  if (config.network === Network.PolygonZkEvm) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.PolygonZkEvm>;
    return new CoreProtocolPolygonZkEvm(coreProtocolParams as CoreProtocolParams<Network.PolygonZkEvm>, {
      marketIds: {
        ...coreProtocolParams.marketIds,
        dai: DAI_MAP[typedConfig.network]!.marketId,
        link: LINK_MAP[typedConfig.network]!.marketId,
        matic: MATIC_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          DAI_MAP[typedConfig.network]!.marketId,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      paraswapEcosystem: await createParaswapEcosystem(typedConfig.network, hhUser1),
      tokens: {
        ...coreProtocolParams.tokens,
        dai: IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
        link: IERC20__factory.connect(LINK_MAP[typedConfig.network]!.address, hhUser1),
        matic: IERC20__factory.connect(MATIC_MAP[typedConfig.network].address, hhUser1),
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        weth: coreProtocolParams.tokens.weth as any,
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
          IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        ],
      },
    }) as any;
  }
  if (config.network === Network.XLayer) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.XLayer>;
    return new CoreProtocolXLayer(coreProtocolParams as CoreProtocolParams<Network.XLayer>, {
      marketIds: {
        ...coreProtocolParams.marketIds,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        wokb: WOKB_MAP[typedConfig.network].marketId,
        stablecoins: [...coreProtocolParams.marketIds.stablecoins, USDT_MAP[typedConfig.network].marketId],
      },
      mineralLiquidityMiningEcosystem: await createMineralLiquidityMiningEcosystem(typedConfig.network, hhUser1),
      okxEcosystem: await createOkxEcosystem(typedConfig.network, hhUser1),
      okxPriceOracleV3: OkxPriceOracleV3__factory.connect(
        Deployments.OkxPriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      tokens: {
        ...coreProtocolParams.tokens,
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        wokb: IWETH__factory.connect(WOKB_MAP[typedConfig.network].address, hhUser1),
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        ],
      },
    }) as any;
  }

  return Promise.reject(new Error(`Invalid network, found: ${config.network}`));
}

export async function setupTestMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: { address: address },
  isClosing: boolean,
  priceOracle?: { address: address },
  marginPremium?: BigNumberish,
  spreadPremium?: BigNumberish,
  earningsRateOverride?: BigNumberish,
) {
  if (core.config.network === Network.ArbitrumOne) {
    await (core.dolomiteMargin as IDolomiteMargin)
      .connect(core.governance)
      .ownerAddMarket(
        token.address,
        (priceOracle ?? core.testEcosystem!.testPriceOracle).address,
        core.testEcosystem!.testInterestSetter.address,
        { value: marginPremium ?? 0 },
        { value: spreadPremium ?? 0 },
        0,
        isClosing,
        false,
      );
  } else {
    await (core.dolomiteMargin as IDolomiteMarginV2)
      .connect(core.governance)
      .ownerAddMarket(
        token.address,
        (priceOracle ?? core.testEcosystem!.testPriceOracle).address,
        core.testEcosystem!.testInterestSetter.address,
        { value: marginPremium ?? 0 },
        { value: spreadPremium ?? 0 },
        0,
        0,
        { value: earningsRateOverride ?? 0 },
        isClosing,
      );
  }
}

function createTokenVaultActionsLibraries<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    IsolationModeTokenVaultV1ActionsImpl: getMaxDeploymentVersionAddressByDeploymentKey(
      'IsolationModeTokenVaultV1ActionsImpl',
      config.network,
    ),
  };
}

function createAsyncUnwrapperImplLibraries<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    AsyncIsolationModeUnwrapperTraderImpl: getMaxDeploymentVersionAddressByDeploymentKey(
      'AsyncIsolationModeUnwrapperTraderImpl',
      config.network,
    ),
  };
}

function createAsyncWrapperImplLibraries<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    AsyncIsolationModeWrapperTraderImpl: getMaxDeploymentVersionAddressByDeploymentKey(
      'AsyncIsolationModeWrapperTraderImpl',
      config.network,
    ),
  };
}

export function getMaxDeploymentVersionAddressByDeploymentKey(
  key: string,
  network: Network,
  defaultAddress?: string,
): address {
  const deploymentsMap = deployments as Record<string, any>;
  const maxVersion = Object.keys(deploymentsMap)
    .filter((k) => k.startsWith(key) && deploymentsMap[k][network])
    .sort((a, b) => {
      // Add an extra 1 for the "V" in the version name
      const subA = a.substring(key.length + 1);
      const subB = b.substring(key.length + 1);
      const valueA = parseInt(subA, 10);
      const valueB = parseInt(subB, 10);
      if (Number.isNaN(valueA)) {
        throw new Error(`Invalid version: ${subA}`);
      }
      if (Number.isNaN(valueB)) {
        throw new Error(`Invalid version: ${subB}`);
      }

      return valueB - valueA;
    })[0];
  if (!maxVersion && !defaultAddress) {
    throw new Error(`Could not find ${key} for network ${network}`);
  }

  if ((!deploymentsMap[maxVersion] || !deploymentsMap[maxVersion][network]) && defaultAddress) {
    return defaultAddress;
  }

  return deploymentsMap[maxVersion][network].address;
}

export function getContract<T>(
  address: string,
  connector: (address: string, signerOrProvider: any) => T,
  signerOrProvider: Signer | Provider,
): T {
  return connector(address, signerOrProvider);
}

export function getContractOpt<T>(
  address: string | undefined,
  connector: (address: string, signerOrProvider: any) => T,
  signerOrProvider: Signer | Provider,
): T | undefined {
  if (!address) {
    return undefined;
  }

  return connector(address, signerOrProvider);
}
