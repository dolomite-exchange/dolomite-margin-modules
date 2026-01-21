import { ApiToken, DolomiteZap } from '@dolomite-exchange/zap-sdk';
import { BigNumberish } from 'ethers';
import { DolomiteOwnerV1, DolomiteOwnerV2, IAdminClaimExcessTokens, IAdminPauseMarket } from 'packages/admin/src/types';
import { IsolationModeVaultType } from 'packages/deployment/src/deploy/isolation-mode/isolation-mode-helpers';
import { IChainlinkPriceOracleV1, IChainlinkPriceOracleV3, OracleAggregatorV2 } from 'packages/oracles/src/types';
import {
  DolomiteERC4626,
  DolomiteERC4626WithPayable,
  IBorrowPositionProxyV2,
  IBorrowPositionRouter,
  IDepositWithdrawalProxy,
  IDepositWithdrawalRouter,
  IDolomiteAccountRegistry,
  IDolomiteAccountRiskOverrideSetter,
  IDolomiteRegistry,
  IERC20,
  IEventEmitterRegistry,
  IGenericTraderProxyV2,
  IGenericTraderRouter,
  ILiquidatorAssetRegistry,
  ILiquidatorProxyV1,
  ILiquidatorProxyV4WithGenericTrader,
  ILiquidatorProxyV6,
  IPartiallyDelayedMultiSig,
  IsolationModeFreezableLiquidatorProxy,
  IWETH,
  LiquidatorProxyV6,
  RegistryProxy,
} from '../../../src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, SUBGRAPH_URL_MAP } from '../../../src/utils/constants';
import { DolomiteNetwork, Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin, Expiry } from '../dolomite';
import { DeployedVault } from '../ecosystem-utils/deployed-vaults';
import { InterestSetters } from '../ecosystem-utils/interest-setters';
import { TestEcosystem } from '../ecosystem-utils/testers';
import { CoreProtocolConfig } from '../setup';

export interface LibraryMaps {
  safeDelegateCallImpl: Record<string, string>;
  tokenVaultActionsImpl: Record<string, string>;
  unwrapperTraderImpl: Record<string, string>;
  wrapperTraderImpl: Record<string, string>;
  genericTraderProxyV2Lib: Record<string, string>;
}

export interface ImplementationContracts {
  dolomiteERC4626Implementation: DolomiteERC4626;
  dolomiteERC4626WithPayableImplementation: DolomiteERC4626WithPayable;
}

export type WETHType<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
  ? IWETH
  : T extends Network.Base
  ? IWETH
  : T extends Network.Berachain
  ? IERC20
  : T extends Network.Botanix
  ? IERC20
  : T extends Network.Ethereum
  ? IWETH
  : T extends Network.Ink
  ? IWETH
  : T extends Network.Mantle
  ? IERC20
  : T extends Network.PolygonZkEvm
  ? IWETH
  : T extends Network.SuperSeed
  ? IWETH
  : T extends Network.XLayer
  ? IERC20
  : never;

export type DolomiteWETHType<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
  ? DolomiteERC4626WithPayable
  : T extends Network.Base
  ? DolomiteERC4626WithPayable
  : T extends Network.Berachain
  ? DolomiteERC4626
  : T extends Network.Botanix
  ? DolomiteERC4626
  : T extends Network.Ethereum
  ? DolomiteERC4626WithPayable
  : T extends Network.Ink
  ? DolomiteERC4626WithPayable
  : T extends Network.Mantle
  ? DolomiteERC4626
  : T extends Network.PolygonZkEvm
  ? DolomiteERC4626WithPayable
  : T extends Network.SuperSeed
  ? DolomiteERC4626WithPayable
  : T extends Network.XLayer
  ? DolomiteERC4626
  : never;

export interface CoreProtocolTokens<T extends DolomiteNetwork> {
  payableToken: IWETH;
  usdc: IERC20;
  weth: WETHType<T>;
  stablecoins: IERC20[];
}

export interface CoreProtocolDolomiteTokens {
  implementationAddress: string;
  payableImplementationAddress: string;
  all: (DolomiteERC4626 | DolomiteERC4626WithPayable)[];
}

export interface CoreProtocolMarketIds {
  usdc: BigNumberish;
  weth: BigNumberish;
  stablecoins: BigNumberish[];
  stablecoinsWithUnifiedInterestRateModels: BigNumberish[];
}

export interface CoreProtocolParams<T extends DolomiteNetwork> {
  config: CoreProtocolConfig<T>;
  daoAddress: string | undefined;
  gnosisSafe: SignerWithAddressWithSafety;
  gnosisSafeAddress: string;
  governance: SignerWithAddressWithSafety;
  governanceAddress: string;
  hhUser1: SignerWithAddressWithSafety;
  hhUser2: SignerWithAddressWithSafety;
  hhUser3: SignerWithAddressWithSafety;
  hhUser4: SignerWithAddressWithSafety;
  hhUser5: SignerWithAddressWithSafety;
  adminClaimExcessTokens: IAdminClaimExcessTokens;
  adminPauseMarket: IAdminPauseMarket;
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  borrowPositionRouter: IBorrowPositionRouter;
  constants: CoreProtocolConstants<T>;
  chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  delayedMultiSig: IPartiallyDelayedMultiSig;
  deployedVaults: DeployedVault[];
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  depositWithdrawalRouter: IDepositWithdrawalRouter;
  dolomiteMargin: DolomiteMargin<T>;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  dolomiteAccountRegistry: IDolomiteAccountRegistry;
  dolomiteAccountRegistryProxy: RegistryProxy;
  dolomiteAccountRiskOverrideSetter: IDolomiteAccountRiskOverrideSetter;
  dolomiteAccountRiskOverrideSetterProxy: RegistryProxy;
  eventEmitterRegistry: IEventEmitterRegistry;
  eventEmitterRegistryProxy: RegistryProxy;
  dTokens: CoreProtocolDolomiteTokens;
  expiry: Expiry<T>;
  freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  genericTraderProxy: IGenericTraderProxyV2;
  genericTraderRouter: IGenericTraderRouter;
  implementationContracts: ImplementationContracts;
  interestSetters: InterestSetters<T>;
  libraries: LibraryMaps;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  liquidatorProxyV6: LiquidatorProxyV6;
  marketIdToDeployedVaultMap: Record<number, DeployedVault>;
  marketIds: CoreProtocolMarketIds;
  oracleAggregatorV2: OracleAggregatorV2;
  ownerAdapterV1: DolomiteOwnerV1;
  ownerAdapterV2: DolomiteOwnerV2;
  testEcosystem: TestEcosystem | undefined;
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  tokens: CoreProtocolTokens<T>;
}

export interface CoreProtocolConstants<T extends DolomiteNetwork> {
  slippageToleranceForPauseSentinel: BigNumberish;
  chainlinkAggregators: (typeof CHAINLINK_PRICE_AGGREGATORS_MAP)[T];
}

export abstract class CoreProtocolAbstract<T extends DolomiteNetwork> {
  /// =========================
  /// Config and Signers
  /// =========================
  /**
   * Config passed through at Core Protocol's creation time
   */
  public readonly config: CoreProtocolConfig<T>;
  public readonly zap: DolomiteZap;
  public readonly daoAddress: string | undefined;
  public readonly gnosisSafe: SignerWithAddressWithSafety;
  public readonly gnosisSafeAddress: string;
  public readonly governance: SignerWithAddressWithSafety;
  public readonly governanceAddress: string;
  public readonly hhUser1: SignerWithAddressWithSafety;
  public readonly hhUser2: SignerWithAddressWithSafety;
  public readonly hhUser3: SignerWithAddressWithSafety;
  public readonly hhUser4: SignerWithAddressWithSafety;
  public readonly hhUser5: SignerWithAddressWithSafety;
  /// =========================
  /// Contracts and Ecosystems
  /// =========================
  public readonly adminClaimExcessTokens: IAdminClaimExcessTokens;
  public readonly adminPauseMarket: IAdminPauseMarket;
  public readonly borrowPositionProxyV2: IBorrowPositionProxyV2;
  public readonly borrowPositionRouter: IBorrowPositionRouter;
  public readonly chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  public readonly chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  public readonly constants: CoreProtocolConstants<T>;
  public readonly delayedMultiSig: IPartiallyDelayedMultiSig;
  public readonly depositWithdrawalProxy: IDepositWithdrawalProxy;
  public readonly depositWithdrawalRouter: IDepositWithdrawalRouter;
  public readonly deployedVaults: DeployedVault[];
  public readonly deployedVaultsMap: Record<number, DeployedVault>;
  public readonly dolomiteMargin: DolomiteMargin<T>;
  public readonly dolomiteRegistry: IDolomiteRegistry;
  public readonly dolomiteRegistryProxy: RegistryProxy;
  public readonly dolomiteTokens: CoreProtocolDolomiteTokens;
  public readonly dolomiteAccountRegistry: IDolomiteAccountRegistry;
  public readonly dolomiteAccountRegistryProxy: RegistryProxy;
  public readonly dolomiteAccountRiskOverrideSetter: IDolomiteAccountRiskOverrideSetter;
  public readonly dolomiteAccountRiskOverrideSetterProxy: RegistryProxy;
  public readonly eventEmitterRegistry: IEventEmitterRegistry;
  public readonly eventEmitterRegistryProxy: RegistryProxy;
  public readonly expiry: Expiry<T>;
  public readonly freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  public readonly genericTraderProxy: IGenericTraderProxyV2;
  public readonly genericTraderRouter: IGenericTraderRouter;
  public readonly implementationContracts: ImplementationContracts;
  public readonly interestSetters: InterestSetters<T>;
  public readonly libraries: LibraryMaps;
  public readonly liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  public readonly liquidatorProxyV1: ILiquidatorProxyV1;
  public readonly liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  public readonly liquidatorProxyV6: LiquidatorProxyV6;
  public readonly oracleAggregatorV2: OracleAggregatorV2;
  public readonly ownerAdapterV1: DolomiteOwnerV1;
  public readonly ownerAdapterV2: DolomiteOwnerV2;
  public readonly testEcosystem: TestEcosystem | undefined;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  public readonly marketIds: CoreProtocolMarketIds;
  public readonly apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  public readonly tokens: CoreProtocolTokens<T>;

  constructor(params: CoreProtocolParams<T>) {
    this.config = params.config;
    this.zap = new DolomiteZap({
      network: this.config.networkNumber,
      subgraphUrl: SUBGRAPH_URL_MAP[this.config.network],
      web3Provider: params.hhUser1.provider!,
      defaultBlockTag: params.config.blockNumber,
    });
    this.daoAddress = params.daoAddress;
    this.gnosisSafe = params.gnosisSafe;
    this.gnosisSafeAddress = params.gnosisSafeAddress;
    this.governance = params.governance;
    this.governanceAddress = params.governanceAddress;
    this.hhUser1 = params.hhUser1;
    this.hhUser2 = params.hhUser2;
    this.hhUser3 = params.hhUser3;
    this.hhUser4 = params.hhUser4;
    this.hhUser5 = params.hhUser5;
    this.adminClaimExcessTokens = params.adminClaimExcessTokens;
    this.adminPauseMarket = params.adminPauseMarket;
    this.borrowPositionProxyV2 = params.borrowPositionProxyV2;
    this.borrowPositionRouter = params.borrowPositionRouter;
    this.chainlinkPriceOracleV1 = params.chainlinkPriceOracleV1;
    this.chainlinkPriceOracleV3 = params.chainlinkPriceOracleV3;
    this.constants = params.constants;
    this.delayedMultiSig = params.delayedMultiSig;
    this.depositWithdrawalProxy = params.depositWithdrawalProxy;
    this.depositWithdrawalRouter = params.depositWithdrawalRouter;
    this.deployedVaults = params.deployedVaults;
    this.deployedVaultsMap = params.marketIdToDeployedVaultMap;
    this.dolomiteMargin = params.dolomiteMargin;
    this.dolomiteRegistry = params.dolomiteRegistry;
    this.dolomiteRegistryProxy = params.dolomiteRegistryProxy;
    this.dolomiteTokens = params.dTokens;
    this.dolomiteAccountRegistry = params.dolomiteAccountRegistry;
    this.dolomiteAccountRegistryProxy = params.dolomiteAccountRegistryProxy;
    this.dolomiteAccountRiskOverrideSetter = params.dolomiteAccountRiskOverrideSetter;
    this.dolomiteAccountRiskOverrideSetterProxy = params.dolomiteAccountRiskOverrideSetterProxy;
    this.eventEmitterRegistry = params.eventEmitterRegistry;
    this.eventEmitterRegistryProxy = params.eventEmitterRegistryProxy;
    this.expiry = params.expiry;
    this.freezableLiquidatorProxy = params.freezableLiquidatorProxy;
    this.genericTraderProxy = params.genericTraderProxy;
    this.genericTraderRouter = params.genericTraderRouter;
    this.implementationContracts = params.implementationContracts;
    this.interestSetters = params.interestSetters;
    this.libraries = params.libraries;
    this.liquidatorAssetRegistry = params.liquidatorAssetRegistry;
    this.liquidatorProxyV1 = params.liquidatorProxyV1;
    this.liquidatorProxyV4 = params.liquidatorProxyV4;
    this.liquidatorProxyV6 = params.liquidatorProxyV6;
    this.oracleAggregatorV2 = params.oracleAggregatorV2;
    this.ownerAdapterV1 = params.ownerAdapterV1;
    this.ownerAdapterV2 = params.ownerAdapterV2;
    this.testEcosystem = params.testEcosystem;
    this.marketIds = params.marketIds;
    this.apiTokens = params.apiTokens;
    this.tokens = params.tokens;
  }

  public abstract get network(): T;

  public getDeployedVaultsByType(vaultType: IsolationModeVaultType): DeployedVault[] {
    return this.deployedVaults.filter((v) => v.vaultType === vaultType);
  }

  public getDeployedVaultsMapByType(vaultType: IsolationModeVaultType): Record<number, DeployedVault> {
    return this.getDeployedVaultsByType(vaultType).reduce((acc, v) => {
      acc[v.marketId] = v;
      return acc;
    }, {} as Record<number, DeployedVault>);
  }
}
