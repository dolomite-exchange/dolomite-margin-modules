import { ApiToken, DolomiteZap } from '@dolomite-exchange/zap-sdk';
import { BigNumberish } from 'ethers';
import { IChainlinkPriceOracleV1, IChainlinkPriceOracleV3, OracleAggregatorV2 } from 'packages/oracles/src/types';
import {
  DolomiteERC4626,
  DolomiteERC4626WithPayable,
  DolomiteOwnerV1,
  DolomiteOwnerV2,
  IBorrowPositionProxyV2,
  IDepositWithdrawalProxy,
  IDolomiteAccountRegistry,
  IDolomiteRegistry,
  IERC20,
  IEventEmitterRegistry,
  IGenericTraderProxyV1,
  ILiquidatorAssetRegistry,
  ILiquidatorProxyV1,
  ILiquidatorProxyV4WithGenericTrader,
  IPartiallyDelayedMultiSig,
  IsolationModeFreezableLiquidatorProxy,
  IWETH,
  RegistryProxy,
} from '../../../src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, SUBGRAPH_URL_MAP } from '../../../src/utils/constants';
import { Network, NetworkType } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin, Expiry } from '../dolomite';
import { InterestSetters } from '../ecosystem-utils/interest-setters';
import { TestEcosystem } from '../ecosystem-utils/testers';
import { CoreProtocolConfig } from '../setup';
import { DeployedVault } from '../ecosystem-utils/deployed-vaults';
import { IsolationModeVaultType } from 'packages/deployment/src/deploy/isolation-mode/isolation-mode-helpers';

export interface LibraryMaps {
  tokenVaultActionsImpl: Record<string, string>;
  unwrapperTraderImpl: Record<string, string>;
  wrapperTraderImpl: Record<string, string>;
}

export interface ImplementationContracts {
  dolomiteERC4626Implementation: DolomiteERC4626;
  dolomiteERC4626WithPayableImplementation: DolomiteERC4626WithPayable;
}

export type WETHType<T extends NetworkType> = T extends Network.ArbitrumOne
  ? IWETH
  : T extends Network.Base
  ? IWETH
  : T extends Network.Berachain
  ? IERC20
  : T extends Network.BerachainCartio
  ? IERC20
  : T extends Network.Mantle
  ? IERC20
  : T extends Network.PolygonZkEvm
  ? IWETH
  : T extends Network.XLayer
  ? IERC20
  : never;

export interface CoreProtocolTokens<T extends NetworkType> {
  payableToken: IWETH;
  usdc: IERC20;
  weth: WETHType<T>;
  stablecoins: IERC20[];
}

export interface CoreProtocolMarketIds {
  usdc: BigNumberish;
  weth: BigNumberish;
  stablecoins: BigNumberish[];
  stablecoinsWithUnifiedInterestRateModels: BigNumberish[];
}

export interface CoreProtocolParams<T extends NetworkType> {
  config: CoreProtocolConfig<T>;
  gnosisSafe: SignerWithAddressWithSafety;
  gnosisSafeAddress: string;
  governance: SignerWithAddressWithSafety;
  hhUser1: SignerWithAddressWithSafety;
  hhUser2: SignerWithAddressWithSafety;
  hhUser3: SignerWithAddressWithSafety;
  hhUser4: SignerWithAddressWithSafety;
  hhUser5: SignerWithAddressWithSafety;
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  constants: CoreProtocolConstants<T>;
  chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  delayedMultiSig: IPartiallyDelayedMultiSig;
  deployedVaults: DeployedVault[];
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteMargin: DolomiteMargin<T>;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  dolomiteAccountRegistry: IDolomiteAccountRegistry;
  dolomiteAccountRegistryProxy: RegistryProxy;
  eventEmitterRegistry: IEventEmitterRegistry;
  eventEmitterRegistryProxy: RegistryProxy;
  expiry: Expiry<T>;
  freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  genericTraderProxy: IGenericTraderProxyV1;
  implementationContracts: ImplementationContracts;
  interestSetters: InterestSetters;
  libraries: LibraryMaps;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
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

export interface CoreProtocolConstants<T extends NetworkType> {
  slippageToleranceForPauseSentinel: BigNumberish;
  chainlinkAggregators: (typeof CHAINLINK_PRICE_AGGREGATORS_MAP)[T];
}

export abstract class CoreProtocolAbstract<T extends NetworkType> {
  /// =========================
  /// Config and Signers
  /// =========================
  /**
   * Config passed through at Core Protocol's creation time
   */
  public readonly config: CoreProtocolConfig<T>;
  public readonly zap: DolomiteZap;
  public readonly gnosisSafe: SignerWithAddressWithSafety;
  public readonly gnosisSafeAddress: string;
  public readonly governance: SignerWithAddressWithSafety;
  public readonly hhUser1: SignerWithAddressWithSafety;
  public readonly hhUser2: SignerWithAddressWithSafety;
  public readonly hhUser3: SignerWithAddressWithSafety;
  public readonly hhUser4: SignerWithAddressWithSafety;
  public readonly hhUser5: SignerWithAddressWithSafety;
  /// =========================
  /// Contracts and Ecosystems
  /// =========================
  public readonly borrowPositionProxyV2: IBorrowPositionProxyV2;
  public readonly chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  public readonly chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  public readonly constants: CoreProtocolConstants<T>;
  public readonly delayedMultiSig: IPartiallyDelayedMultiSig;
  public readonly depositWithdrawalProxy: IDepositWithdrawalProxy;
  public readonly deployedVaults: DeployedVault[];
  public readonly deployedVaultsMap: Record<number, DeployedVault>;
  public readonly dolomiteMargin: DolomiteMargin<T>;
  public readonly dolomiteRegistry: IDolomiteRegistry;
  public readonly dolomiteRegistryProxy: RegistryProxy;
  public readonly dolomiteAccountRegistry: IDolomiteAccountRegistry;
  public readonly dolomiteAccountRegistryProxy: RegistryProxy;
  public readonly eventEmitterRegistry: IEventEmitterRegistry;
  public readonly eventEmitterRegistryProxy: RegistryProxy;
  public readonly expiry: Expiry<T>;
  public readonly freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  public readonly genericTraderProxy: IGenericTraderProxyV1;
  public readonly implementationContracts: ImplementationContracts;
  public readonly interestSetters: InterestSetters;
  public readonly libraries: LibraryMaps;
  public readonly liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  public readonly liquidatorProxyV1: ILiquidatorProxyV1;
  public readonly liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
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
    this.gnosisSafe = params.gnosisSafe;
    this.gnosisSafeAddress = params.gnosisSafeAddress;
    this.governance = params.governance;
    this.hhUser1 = params.hhUser1;
    this.hhUser2 = params.hhUser2;
    this.hhUser3 = params.hhUser3;
    this.hhUser4 = params.hhUser4;
    this.hhUser5 = params.hhUser5;
    this.borrowPositionProxyV2 = params.borrowPositionProxyV2;
    this.chainlinkPriceOracleV1 = params.chainlinkPriceOracleV1;
    this.chainlinkPriceOracleV3 = params.chainlinkPriceOracleV3;
    this.constants = params.constants;
    this.delayedMultiSig = params.delayedMultiSig;
    this.depositWithdrawalProxy = params.depositWithdrawalProxy;
    this.deployedVaults = params.deployedVaults;
    this.deployedVaultsMap = params.marketIdToDeployedVaultMap;
    this.dolomiteMargin = params.dolomiteMargin;
    this.dolomiteRegistry = params.dolomiteRegistry;
    this.dolomiteRegistryProxy = params.dolomiteRegistryProxy;
    this.dolomiteAccountRegistry = params.dolomiteAccountRegistry;
    this.dolomiteAccountRegistryProxy = params.dolomiteAccountRegistryProxy;
    this.eventEmitterRegistry = params.eventEmitterRegistry;
    this.eventEmitterRegistryProxy = params.eventEmitterRegistryProxy;
    this.expiry = params.expiry;
    this.freezableLiquidatorProxy = params.freezableLiquidatorProxy;
    this.genericTraderProxy = params.genericTraderProxy;
    this.implementationContracts = params.implementationContracts;
    this.interestSetters = params.interestSetters;
    this.libraries = params.libraries;
    this.liquidatorAssetRegistry = params.liquidatorAssetRegistry;
    this.liquidatorProxyV1 = params.liquidatorProxyV1;
    this.liquidatorProxyV4 = params.liquidatorProxyV4;
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
    return this.deployedVaults.filter(v => v.vaultType === vaultType);
  }

  public getDeployedVaultsMapByType(vaultType: IsolationModeVaultType): Record<number, DeployedVault> {
    return this.getDeployedVaultsByType(vaultType).reduce((acc, v) => {
      acc[v.marketId] = v;
      return acc;
    }, {} as Record<number, DeployedVault>);
  }
}
