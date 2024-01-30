import {
  IChainlinkPriceOracle,
  IChainlinkRegistry,
} from '@dolomite-exchange/modules-oracles/src/types';
import { ApiToken } from '@dolomite-exchange/zap-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import {
  IBorrowPositionProxyV2,
  IDepositWithdrawalProxy,
  IDolomiteAmmFactory,
  IDolomiteAmmRouterProxy,
  IDolomiteMargin,
  IDolomiteRegistry,
  IERC20,
  IEventEmitterRegistry,
  IExpiry,
  IGenericTraderProxyV1,
  ILiquidatorAssetRegistry,
  ILiquidatorProxyV1,
  ILiquidatorProxyV1WithAmm,
  ILiquidatorProxyV4WithGenericTrader,
  IPartiallyDelayedMultiSig,
  IWETH,
  RegistryProxy,
} from '../../src/types';
import {
  AbraEcosystem,
  ArbEcosystem,
  CamelotEcosystem,
  CoreProtocolConfig,
  GmxEcosystem,
  GmxEcosystemV2,
  InterestSetters,
  JonesEcosystem,
  LiquidityMiningEcosystem,
  OdosEcosystem,
  ParaswapEcosystem,
  PendleEcosystem,
  PlutusEcosystem,
  PremiaEcosystem,
  TestEcosystem,
  UmamiEcosystem,
} from './setup';

interface CoreProtocolTokens {
  dai: IERC20;
  link: IERC20;
  usdc: IERC20;
  wbtc: IERC20;
  weth: IWETH;
}

interface CoreProtocolMarketIds {
  dai: BigNumberish;
  link: BigNumberish;
  usdc: BigNumberish;
  wbtc: BigNumberish;
  weth: BigNumberish;
}

interface CoreProtocolTokensArbitrumOne extends CoreProtocolTokens {
  arb: IERC20;
  dArb: IERC20;
  dfsGlp: IERC20;
  dGmx: IERC20;
  dPtGlp: IERC20;
  dPtREthJun2025: IERC20;
  dPtWstEthJun2024: IERC20;
  dPtWstEthJun2025: IERC20;
  dpx: IERC20;
  dYtGlp: IERC20;
  gmx: IERC20;
  grail: IERC20;
  jones: IERC20;
  magic: IERC20;
  nativeUsdc: IERC20;
  premia: IERC20;
  rEth: IERC20;
  radiant: IERC20;
  pendle: IERC20;
  size: IERC20;
  stEth: IERC20;
  wstEth: IERC20;
}

interface CoreProtocolMarketIdsArbitrumOne extends CoreProtocolMarketIds {
  arb: BigNumberish;
  dArb: BigNumberish;
  dfsGlp: BigNumberish;
  dGmx: BigNumberish;
  djUSDC: BigNumberish;
  dplvGlp: BigNumberish;
  dPtGlp: BigNumberish;
  dPtREthJun2025: BigNumberish;
  dPtWstEthJun2024: BigNumberish;
  dPtWstEthJun2025: BigNumberish;
  dpx: BigNumberish;
  dYtGlp: BigNumberish;
  grail: BigNumberish;
  jones: BigNumberish;
  magic: BigNumberish;
  magicGlp: BigNumberish;
  mim: BigNumberish;
  nativeUsdc: BigNumberish;
  premia: BigNumberish;
  rEth: BigNumberish;
  radiant: BigNumberish;
  pendle: BigNumberish;
  usdt: BigNumberish;
  wstEth: BigNumberish;
}

export interface CoreProtocolBase {
  /// =========================
  /// Config and Signers
  /// =========================
  /**
   * Config passed through at Core Protocol's creation time
   */
  config: CoreProtocolConfig;
  governance: SignerWithAddress;
  hhUser1: SignerWithAddress;
  hhUser2: SignerWithAddress;
  hhUser3: SignerWithAddress;
  hhUser4: SignerWithAddress;
  hhUser5: SignerWithAddress;
  /// =========================
  /// Contracts and Ecosystems
  /// =========================
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  delayedMultiSig: IPartiallyDelayedMultiSig;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmFactory: IDolomiteAmmFactory;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  eventEmitterRegistry: IEventEmitterRegistry;
  eventEmitterRegistryProxy: RegistryProxy;
  expiry: IExpiry;
  genericTraderProxy: IGenericTraderProxyV1;
  interestSetters: InterestSetters;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV1WithAmm: ILiquidatorProxyV1WithAmm;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  testEcosystem: TestEcosystem | undefined;
  tokenVaultActionsLibraries: Record<string, string>;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  marketIds: CoreProtocolMarketIds;
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  tokens: CoreProtocolTokens;
}

export interface CoreProtocolArbitrumOne extends CoreProtocolBase {
  abraEcosystem: AbraEcosystem;
  arbEcosystem: ArbEcosystem;
  camelotEcosystem: CamelotEcosystem;
  chainlinkAutomationRegistry: IChainlinkRegistry;
  chainlinkPriceOracle: IChainlinkPriceOracle;
  gmxEcosystem: GmxEcosystem;
  gmxEcosystemV2: GmxEcosystemV2;
  jonesEcosystem: JonesEcosystem;
  liquidityMiningEcosystem: LiquidityMiningEcosystem;
  marketIds: CoreProtocolMarketIdsArbitrumOne;
  odosEcosystem: OdosEcosystem;
  paraswapEcosystem: ParaswapEcosystem;
  pendleEcosystem: PendleEcosystem;
  plutusEcosystem: PlutusEcosystem;
  premiaEcosystem: PremiaEcosystem;
  tokens: CoreProtocolTokensArbitrumOne;
  umamiEcosystem: UmamiEcosystem;
}

export interface CoreProtocolPolygonZkEvm extends CoreProtocolBase {

}

export interface CoreProtocolZkEvm extends CoreProtocolBase {
}
