import { ApiToken, BigNumber as ZapBigNumber } from '@dolomite-exchange/zap-sdk/dist';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as IGenericTraderProxyV1Json from '@dolomite-margin/deployed-contracts/GenericTraderProxyV1.json';
import * as LiquidatorAssetRegistryJson from '@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json';
import * as LiquidatorProxyV1Json from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json';
import * as LiquidatorProxyV1WithAmmJson from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1WithAmm.json';
import * as LiquidatorProxyV2WithExternalLiquidityJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import * as LiquidatorProxyV3WithLiquidityTokenJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV3WithLiquidityToken.json';
import * as LiquidatorProxyV4WithGenericTraderJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV4WithGenericTrader.json';
import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface, Signer } from 'ethers';
import { ethers, network } from 'hardhat';
import { IParaswapFeeClaimer } from 'src/types/contracts/external/interfaces/traders/IParaswapFeeClaimer';
import { Network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP, NetworkName } from 'src/utils/no-deps-constants';
import Deployments from '../../scripts/deployments.json';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  IBorrowPositionProxyV2,
  IBorrowPositionProxyV2__factory,
  IChainlinkRegistry,
  IChainlinkRegistry__factory,
  IDepositWithdrawalProxy,
  IDepositWithdrawalProxy__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteInterestSetter,
  IDolomiteInterestSetter__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IDolomiteRegistry,
  IDolomiteRegistry__factory,
  IERC20,
  IERC20__factory,
  IERC4626,
  IERC4626__factory,
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
  IExpiry,
  IExpiry__factory,
  IGenericTraderProxyV1,
  IGenericTraderProxyV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGLPIsolationModeVaultFactoryOld__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardsRouterV2,
  IGLPRewardsRouterV2__factory,
  IGmxRegistryV1,
  IGmxRegistryV1__factory,
  IGmxRewardRouterV2,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester,
  IGmxVester__factory,
  IJonesGLPAdapter,
  IJonesGLPAdapter__factory,
  IJonesGLPVaultRouter,
  IJonesGLPVaultRouter__factory,
  IJonesUSDCIsolationModeVaultFactory,
  IJonesUSDCIsolationModeVaultFactory__factory,
  IJonesUSDCRegistry,
  IJonesUSDCRegistry__factory,
  IJonesWhitelistController,
  IJonesWhitelistController__factory,
  ILiquidatorAssetRegistry,
  ILiquidatorAssetRegistry__factory,
  ILiquidatorProxyV1,
  ILiquidatorProxyV1__factory,
  ILiquidatorProxyV1WithAmm,
  ILiquidatorProxyV1WithAmm__factory,
  ILiquidatorProxyV2WithExternalLiquidity,
  ILiquidatorProxyV2WithExternalLiquidity__factory,
  ILiquidatorProxyV3WithLiquidityToken,
  ILiquidatorProxyV3WithLiquidityToken__factory,
  ILiquidatorProxyV4WithGenericTrader,
  ILiquidatorProxyV4WithGenericTrader__factory, IOdosRouter, IOdosRouter__factory,
  IParaswapAugustusRouter,
  IParaswapAugustusRouter__factory,
  IParaswapFeeClaimer__factory,
  IPendleGLPRegistry,
  IPendleGLPRegistry__factory,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendlePtGLP2024IsolationModeVaultFactory__factory,
  IPendlePtMarket,
  IPendlePtMarket__factory,
  IPendlePtOracle,
  IPendlePtOracle__factory,
  IPendlePtToken,
  IPendlePtToken__factory,
  IPendleRouter,
  IPendleRouter__factory,
  IPendleSyToken,
  IPendleSyToken__factory,
  IPendleYtToken,
  IPendleYtToken__factory,
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPFarm__factory,
  IPlutusVaultGLPIsolationModeVaultFactory,
  IPlutusVaultGLPIsolationModeVaultFactory__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  IPlutusVaultRegistry,
  IPlutusVaultRegistry__factory,
  ISGMX,
  ISGMX__factory,
  IUmamiAssetVault,
  IUmamiAssetVault__factory,
  IUmamiAssetVaultStorageViewer,
  IUmamiAssetVaultStorageViewer__factory,
  IWETH,
  IWETH__factory,
  ParaswapAggregatorTrader,
  ParaswapAggregatorTrader__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  RegistryProxy,
  RegistryProxy__factory,
  TestDolomiteMarginExchangeWrapper,
  TestDolomiteMarginExchangeWrapper__factory,
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../src/types';
import {
  ALWAYS_ZERO_INTEREST_SETTER_MAP,
  ATLAS_SI_TOKEN_MAP,
  CHAINLINK_REGISTRY_MAP,
  DAI_MAP,
  DFS_GLP_MAP,
  DJ_USDC,
  DPLV_GLP_MAP,
  DPT_GLP_MAP,
  ES_GMX_DISTRIBUTOR_MAP,
  ES_GMX_MAP,
  FS_GLP_MAP,
  GLP_MANAGER_MAP,
  GLP_MAP,
  GLP_REWARD_ROUTER_MAP,
  GMX_MAP,
  GMX_REWARD_ROUTER_MAP,
  GMX_VAULT_MAP,
  JONES_ECOSYSTEM_GOVERNOR_MAP,
  JONES_GLP_ADAPTER_MAP,
  JONES_GLP_VAULT_ROUTER_MAP,
  JONES_JUSDC_MAP,
  JONES_JUSDC_RECEIPT_TOKEN_MAP,
  JONES_WHITELIST_CONTROLLER_MAP,
  LINK_MAP,
  MAGIC_GLP_MAP,
  MIM_MAP, ODOS_ROUTER_MAP,
  PARASWAP_AUGUSTUS_ROUTER_MAP,
  PARASWAP_FEE_CLAIMER_MAP,
  PARASWAP_TRANSFER_PROXY_MAP,
  PENDLE_PT_GLP_2024_MARKET_MAP,
  PENDLE_PT_GLP_2024_TOKEN_MAP,
  PENDLE_PT_ORACLE_MAP,
  PENDLE_ROUTER_MAP,
  PENDLE_SY_GLP_2024_TOKEN_MAP,
  PENDLE_YT_GLP_2024_TOKEN_MAP,
  PLS_TOKEN_MAP,
  PLV_GLP_FARM_MAP,
  PLV_GLP_MAP,
  PLV_GLP_ROUTER_MAP,
  S_GLP_MAP,
  S_GMX_MAP,
  SBF_GMX_MAP,
  UMAMI_CONFIGURATOR_MAP,
  UMAMI_LINK_VAULT_MAP,
  UMAMI_STORAGE_VIEWER_MAP,
  UMAMI_UNI_VAULT_MAP,
  UMAMI_USDC_VAULT_MAP,
  UMAMI_WBTC_VAULT_MAP,
  UMAMI_WETH_VAULT_MAP,
  USDC_MAP,
  USDT_MAP,
  V_GLP_MAP,
  V_GMX_MAP,
  WBTC_MAP,
  WETH_MAP,
} from '../../src/utils/constants';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { createDolomiteRegistryImplementation } from './dolomite';
import { impersonate, impersonateOrFallback, resetFork } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  blockNumber: number;
  network: Network;
}

export interface CoreProtocolConfig {
  blockNumber: number;
  network: Network;
}

export interface AbraEcosystem {
  magicGlp: IERC4626;
}

export interface AtlasEcosystem {
  siToken: IERC20;
}

export interface GmxEcosystem {
  esGmx: IERC20;
  esGmxDistributor: IEsGmxDistributor;
  fsGlp: IERC20;
  glp: IERC20;
  glpManager: IGLPManager;
  glpRewardsRouter: IGLPRewardsRouterV2;
  gmx: IERC20;
  gmxRewardsRouter: IGmxRewardRouterV2;
  gmxVault: IGmxVault;
  sGlp: IERC20;
  sGmx: ISGMX;
  sbfGmx: IERC20;
  vGlp: IGmxVester;
  vGmx: IGmxVester;
  live: {
    glpIsolationModeFactory: IGLPIsolationModeVaultFactoryOld;
    glpIsolationModeUnwrapperTraderV1: GLPIsolationModeUnwrapperTraderV1;
    glpIsolationModeWrapperTraderV1: GLPIsolationModeWrapperTraderV1;
    gmxRegistry: IGmxRegistryV1;
  };
}

export interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistController: IJonesWhitelistController;
  usdcReceiptToken: IERC4626;
  jUSDC: IERC4626;
  admin: SignerWithAddress;
  live: {
    jUSDCIsolationModeFactory: IJonesUSDCIsolationModeVaultFactory;
    jonesUSDCRegistry: IJonesUSDCRegistry;
  };
}

export interface OdosEcosystem {
  odosRouter: IOdosRouter;
}

export interface ParaswapEcosystem {
  augustusRouter: IParaswapAugustusRouter;
  feeClaimer: IParaswapFeeClaimer;
  transferProxy: address;
}

export interface PendleEcosystem {
  pendleRouter: IPendleRouter;
  ptGlpMarket: IPendlePtMarket;
  ptGlpToken: IPendlePtToken;
  ptOracle: IPendlePtOracle;
  syGlpToken: IPendleSyToken;
  ytGlpToken: IPendleYtToken;
  live: {
    ptGlpIsolationModeFactory: IPendlePtGLP2024IsolationModeVaultFactory;
    pendleGLP2024Registry: IPendleGLPRegistry
    pendleGLP2024RegistryProxy: RegistryProxy
  };
}

export interface PlutusEcosystem {
  plvGlp: IERC4626;
  plsToken: IERC20;
  plvGlpFarm: IPlutusVaultGLPFarm;
  plvGlpRouter: IPlutusVaultGLPRouter;
  sGlp: IERC20;
  live: {
    dolomiteWhitelistForGlpDepositor: DolomiteCompatibleWhitelistForPlutusDAO;
    dolomiteWhitelistForPlutusChef: DolomiteCompatibleWhitelistForPlutusDAO;
    plutusVaultRegistry: IPlutusVaultRegistry;
    plvGlpIsolationModeFactory: IPlutusVaultGLPIsolationModeVaultFactory;
    plvGlpIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
    plvGlpIsolationModeWrapperTraderV1: PlutusVaultGLPIsolationModeWrapperTraderV1;
  };
}

export interface TestEcosystem {
  testExchangeWrapper: TestDolomiteMarginExchangeWrapper;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
}

export interface UmamiEcosystem {
  glpLink: IUmamiAssetVault;
  glpUni: IUmamiAssetVault;
  glpUsdc: IUmamiAssetVault;
  glpWbtc: IUmamiAssetVault;
  glpWeth: IUmamiAssetVault;
  storageViewer: IUmamiAssetVaultStorageViewer;
  configurator: Signer;
}

export interface CoreProtocol {
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
  abraEcosystem: AbraEcosystem | undefined;
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  atlasEcosystem: AtlasEcosystem | undefined;
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  chainlinkRegistry: IChainlinkRegistry | undefined;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmFactory: IDolomiteAmmFactory;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  expiry: IExpiry;
  genericTraderProxy: IGenericTraderProxyV1 | undefined;
  gmxEcosystem: GmxEcosystem | undefined;
  jonesEcosystem: JonesEcosystem | undefined;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV1WithAmm: ILiquidatorProxyV1WithAmm;
  liquidatorProxyV2: ILiquidatorProxyV2WithExternalLiquidity | undefined;
  liquidatorProxyV3: ILiquidatorProxyV3WithLiquidityToken | undefined;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  odosEcosystem: OdosEcosystem | undefined;
  paraswapEcosystem: ParaswapEcosystem | undefined;
  paraswapTrader: ParaswapAggregatorTrader | undefined;
  pendleEcosystem: PendleEcosystem | undefined;
  plutusEcosystem: PlutusEcosystem | undefined;
  testEcosystem: TestEcosystem | undefined;
  umamiEcosystem: UmamiEcosystem | undefined;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  marketIds: {
    dai: BigNumberish | undefined;
    dfsGlp: BigNumberish | undefined;
    djUSDC: BigNumberish | undefined;
    dplvGlp: BigNumberish | undefined;
    dPtGlp: BigNumberish | undefined;
    link: BigNumberish;
    magicGlp: BigNumberish | undefined;
    mim: BigNumberish | undefined;
    usdc: BigNumberish;
    usdt: BigNumberish | undefined;
    wbtc: BigNumberish;
    weth: BigNumberish;
  };
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  tokens: {
    dfsGlp: IERC20 | undefined;
    link: IERC20;
    usdc: IERC20;
    wbtc: IERC20;
    weth: IWETH;
  };
}

export async function disableInterestAccrual(core: CoreProtocol, marketId: BigNumberish) {
  return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.alwaysZeroInterestSetter.address);
}

export async function setupWETHBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  await core.tokens.weth.connect(signer).deposit({ value: amount });
  await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupGMXBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.gmxEcosystem?.gmx.connect(whaleSigner).transfer(signer.address, amount);
  await core.gmxEcosystem?.gmx.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export function setupUserVaultProxy<T extends BaseContract>(
  vault: address,
  factoryInterface: { abi: ContractInterface },
  signer?: SignerWithAddress,
): T {
  return new BaseContract(
    vault,
    factoryInterface.abi,
    signer,
  ) as T;
}

export function getDefaultCoreProtocolConfig(network: Network): CoreProtocolConfig {
  return {
    network,
    blockNumber: NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network],
  };
}

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber, config.network);
  } else {
    console.log('\tSkipping forking...');
  }

  const DOLOMITE_MARGIN = new BaseContract(
    DolomiteMarginJson.networks[config.network].address,
    IDolomiteMargin__factory.createInterface(),
  ) as IDolomiteMargin;

  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const governance: SignerWithAddress = await impersonateOrFallback(
    await DOLOMITE_MARGIN.connect(hhUser1).owner(),
    true,
    hhUser1,
  );

  const alwaysZeroInterestSetter = IDolomiteInterestSetter__factory.connect(
    ALWAYS_ZERO_INTEREST_SETTER_MAP[config.network],
    governance,
  );

  const borrowPositionProxyV2 = IBorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
  );

  const chainlinkRegistry = getContractOpt(
    CHAINLINK_REGISTRY_MAP[config.network],
    IChainlinkRegistry__factory.connect,
  );

  const depositWithdrawalProxy = IDepositWithdrawalProxy__factory.connect(
    DepositWithdrawalProxyJson.networks[config.network].address,
    governance,
  );

  const dolomiteAmmFactory = IDolomiteAmmFactory__factory.connect(
    DolomiteAmmFactoryJson.networks[config.network].address,
    governance,
  );

  const dolomiteAmmRouterProxy = IDolomiteAmmRouterProxy__factory.connect(
    DolomiteAmmRouterProxyJson.networks[config.network].address,
    governance,
  );

  const dolomiteMargin = DOLOMITE_MARGIN.connect(governance);

  let dolomiteRegistry: IDolomiteRegistry;
  let dolomiteRegistryProxy: RegistryProxy;
  if (
    config.blockNumber >= NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[config.network]
    || network.name === NetworkName.ArbitrumOne
  ) {
    dolomiteRegistry = IDolomiteRegistry__factory.connect(
      (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
      governance,
    );
    dolomiteRegistryProxy = RegistryProxy__factory.connect(
      (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
      governance,
    );
  } else {
    // Use a "dummy" implementation
    const implementation = await createDolomiteRegistryImplementation();
    dolomiteRegistry = IDolomiteRegistry__factory.connect(implementation.address, hhUser1);
    dolomiteRegistryProxy = null as any;
  }

  const expiry = IExpiry__factory.connect(
    ExpiryJson.networks[config.network].address,
    governance,
  );

  const genericTraderProxy = getContractOpt(
    (IGenericTraderProxyV1Json.networks as any)[config.network]?.address,
    IGenericTraderProxyV1__factory.connect,
  );

  const liquidatorAssetRegistry = ILiquidatorAssetRegistry__factory.connect(
    LiquidatorAssetRegistryJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1 = ILiquidatorProxyV1__factory.connect(
    LiquidatorProxyV1Json.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1WithAmm = ILiquidatorProxyV1WithAmm__factory.connect(
    LiquidatorProxyV1WithAmmJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV2 = getContractOpt(
    (LiquidatorProxyV2WithExternalLiquidityJson.networks as any)[config.network]?.address,
    ILiquidatorProxyV2WithExternalLiquidity__factory.connect,
  );

  const liquidatorProxyV3 = getContractOpt(
    (LiquidatorProxyV3WithLiquidityTokenJson.networks as any)[config.network]?.address,
    ILiquidatorProxyV3WithLiquidityToken__factory.connect,
  );

  const liquidatorProxyV4 = getContract(
    (LiquidatorProxyV4WithGenericTraderJson.networks as any)[config.network].address,
    ILiquidatorProxyV4WithGenericTrader__factory.connect,
  );

  const paraswapTrader = getContractOpt(
    (Deployments.ParaswapAggregatorTrader as any)[config.network]?.address,
    ParaswapAggregatorTrader__factory.connect,
  );

  const abraEcosystem = await createAbraEcosystem(config.network, hhUser1);
  const atlasEcosystem = await createAtlasEcosystem(config.network, hhUser1);
  const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);
  const jonesEcosystem = await createJonesEcosystem(config.network, hhUser1);
  const odosEcosystem = await createOdosEcosystem(config.network, hhUser1);
  const paraswapEcosystem = await createParaswapEcosystem(config.network, hhUser1);
  const pendleEcosystem = await createPendleEcosystem(config.network, hhUser1);
  const plutusEcosystem = await createPlutusEcosystem(config.network, hhUser1);
  const testEcosystem = await createTestEcosystem(dolomiteMargin, dolomiteRegistry, governance, hhUser1, config);
  const umamiEcosystem = await createUmamiEcosystem(config.network, hhUser1);

  return {
    abraEcosystem,
    alwaysZeroInterestSetter,
    atlasEcosystem,
    borrowPositionProxyV2,
    chainlinkRegistry,
    depositWithdrawalProxy,
    dolomiteAmmFactory,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    dolomiteRegistry,
    dolomiteRegistryProxy,
    expiry,
    genericTraderProxy,
    gmxEcosystem,
    governance,
    jonesEcosystem,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV1WithAmm,
    liquidatorProxyV2,
    liquidatorProxyV3,
    liquidatorProxyV4,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    odosEcosystem,
    paraswapEcosystem,
    paraswapTrader,
    pendleEcosystem,
    plutusEcosystem,
    testEcosystem,
    umamiEcosystem,
    config: {
      blockNumber: config.blockNumber,
      network: config.network,
    },
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
    marketIds: {
      dai: DAI_MAP[config.network]?.marketId,
      dfsGlp: DFS_GLP_MAP[config.network]?.marketId,
      djUSDC: DJ_USDC[config.network]?.marketId,
      dplvGlp: DPLV_GLP_MAP[config.network]?.marketId,
      dPtGlp: DPT_GLP_MAP[config.network]?.marketId,
      link: LINK_MAP[config.network].marketId,
      magicGlp: MAGIC_GLP_MAP[config.network]?.marketId,
      mim: MIM_MAP[config.network]?.marketId,
      usdc: USDC_MAP[config.network].marketId,
      usdt: USDT_MAP[config.network]?.marketId,
      wbtc: WBTC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
    },
    tokens: {
      dfsGlp: createIERC20Opt(DFS_GLP_MAP[config.network]?.address, hhUser1),
      link: IERC20__factory.connect(LINK_MAP[config.network].address, hhUser1),
      usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
      wbtc: IERC20__factory.connect(WBTC_MAP[config.network].address, hhUser1),
      weth: IWETH__factory.connect(WETH_MAP[config.network].address, hhUser1),
    },
  };
}

function createIERC20Opt(address: string | undefined, signerOrProvider: SignerWithAddress): IERC20 | undefined {
  if (!address) {
    return undefined;
  }

  return IERC20__factory.connect(address, signerOrProvider);
}

export async function setupTestMarket(
  core: CoreProtocol,
  token: { address: address },
  isClosing: boolean,
  priceOracle?: { address: address },
  marginPremium?: BigNumberish,
  spreadPremium?: BigNumberish,
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    (priceOracle ?? core.testEcosystem!.testPriceOracle).address,
    core.testEcosystem!.testInterestSetter.address,
    { value: marginPremium ?? 0 },
    { value: spreadPremium ?? 0 },
    0,
    isClosing,
    false,
  );
}

async function createTestEcosystem(
  dolomiteMargin: IDolomiteMargin,
  dolomiteRegistry: IDolomiteRegistry,
  governor: SignerWithAddress,
  signer: SignerWithAddress,
  config: CoreProtocolSetupConfig,
): Promise<TestEcosystem | undefined> {
  if (network.name !== 'hardhat') {
    return undefined;
  }

  if (config.blockNumber >= NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[config.network]) {
    const genericTrader = await dolomiteRegistry.genericTraderProxy();
    await dolomiteMargin.ownerSetGlobalOperator(genericTrader, true);
    const registryProxy = RegistryProxy__factory.connect(dolomiteRegistry.address, governor);
    const newRegistry = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await registryProxy.upgradeTo(newRegistry.address);
    await dolomiteRegistry.ownerSetSlippageToleranceForPauseSentinel('70000000000000000'); // 7%
  }

  const testExchangeWrapper = await createContractWithAbi<TestDolomiteMarginExchangeWrapper>(
    TestDolomiteMarginExchangeWrapper__factory.abi,
    TestDolomiteMarginExchangeWrapper__factory.bytecode,
    [dolomiteMargin.address],
  );
  const testInterestSetter = await createContractWithAbi<TestInterestSetter>(
    TestInterestSetter__factory.abi,
    TestInterestSetter__factory.bytecode,
    [],
  );
  const testPriceOracle = await createContractWithAbi<TestPriceOracle>(
    TestPriceOracle__factory.abi,
    TestPriceOracle__factory.bytecode,
    [],
  );
  return {
    testExchangeWrapper: testExchangeWrapper.connect(signer),
    testInterestSetter: testInterestSetter.connect(signer),
    testPriceOracle: testPriceOracle.connect(signer),
  };
}

async function createAbraEcosystem(network: Network, signer: SignerWithAddress): Promise<AbraEcosystem | undefined> {
  if (!MAGIC_GLP_MAP[network]) {
    return undefined;
  }

  return {
    magicGlp: getContract(
      MAGIC_GLP_MAP[network]?.address as string,
      address => IERC4626__factory.connect(address, signer),
    ),
  };
}

async function createAtlasEcosystem(network: Network, signer: SignerWithAddress): Promise<AtlasEcosystem | undefined> {
  if (!ATLAS_SI_TOKEN_MAP[network]) {
    return undefined;
  }

  return {
    siToken: getContract(ATLAS_SI_TOKEN_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
  };
}

async function createJonesEcosystem(network: Network, signer: SignerWithAddress): Promise<JonesEcosystem | undefined> {
  if (!JONES_ECOSYSTEM_GOVERNOR_MAP[network]) {
    return undefined;
  }

  const whitelist = getContract(
    JONES_WHITELIST_CONTROLLER_MAP[network] as string,
    address => IJonesWhitelistController__factory.connect(address, signer),
  );
  return {
    admin: await impersonateOrFallback(JONES_ECOSYSTEM_GOVERNOR_MAP[network]!, true, signer),
    glpAdapter: getContract(
      JONES_GLP_ADAPTER_MAP[network] as string,
      address => IJonesGLPAdapter__factory.connect(address, signer),
    ),
    glpVaultRouter: getContract(
      JONES_GLP_VAULT_ROUTER_MAP[network] as string,
      address => IJonesGLPVaultRouter__factory.connect(address, signer),
    ),
    usdcReceiptToken: getContract(
      JONES_JUSDC_RECEIPT_TOKEN_MAP[network] as string,
      address => IERC4626__factory.connect(address, signer),
    ),
    jUSDC: getContract(JONES_JUSDC_MAP[network] as string, address => IERC4626__factory.connect(address, signer)),
    whitelistController: whitelist,
    live: {
      jUSDCIsolationModeFactory: getContract(
        (Deployments.JonesUSDCIsolationModeVaultFactory as any)[network]?.address,
        IJonesUSDCIsolationModeVaultFactory__factory.connect,
      ),
      jonesUSDCRegistry: getContract(
        (Deployments.JonesUSDCRegistryProxy as any)[network]?.address,
        IJonesUSDCRegistry__factory.connect,
      ),
    },
  };
}

async function createGmxEcosystem(network: Network, signer: SignerWithAddress): Promise<GmxEcosystem | undefined> {
  const esGmxDistributorAddress = ES_GMX_DISTRIBUTOR_MAP[network];
  if (!esGmxDistributorAddress) {
    return undefined;
  }

  const esGmxDistributor = getContract(esGmxDistributorAddress, IEsGmxDistributor__factory.connect);
  const esGmxAdmin = await impersonateOrFallback(await esGmxDistributor.connect(signer).admin(), true, signer);
  return {
    esGmx: getContract(ES_GMX_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    esGmxDistributor: esGmxDistributor.connect(esGmxAdmin),
    fsGlp: getContract(FS_GLP_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    glp: getContract(GLP_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    glpManager: getContract(
      GLP_MANAGER_MAP[network] as string,
      address => IGLPManager__factory.connect(address, signer),
    ),
    glpRewardsRouter: getContract(
      GLP_REWARD_ROUTER_MAP[network] as string,
      address => IGLPRewardsRouterV2__factory.connect(address, signer),
    ),
    gmxRewardsRouter: getContract(
      GMX_REWARD_ROUTER_MAP[network] as string,
      address => IGmxRewardRouterV2__factory.connect(address, signer),
    ),
    gmx: getContract(GMX_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    gmxVault: getContract(GMX_VAULT_MAP[network] as string, address => IGmxVault__factory.connect(address, signer)),
    sGlp: getContract(S_GLP_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    sGmx: getContract(S_GMX_MAP[network] as string, address => ISGMX__factory.connect(address, signer)),
    sbfGmx: getContract(SBF_GMX_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    vGlp: getContract(V_GLP_MAP[network] as string, address => IGmxVester__factory.connect(address, signer)),
    vGmx: getContract(V_GMX_MAP[network] as string, address => IGmxVester__factory.connect(address, signer)),
    live: {
      glpIsolationModeFactory: getContract(
        (Deployments.GLPIsolationModeVaultFactory as any)[network]?.address,
        IGLPIsolationModeVaultFactoryOld__factory.connect,
      ),
      glpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeUnwrapperTraderV1__factory.connect,
      ),
      glpIsolationModeWrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeWrapperTraderV1__factory.connect,
      ),
      gmxRegistry: getContract(
        (Deployments.GmxRegistryProxy as any)[network]?.address,
        IGmxRegistryV1__factory.connect,
      ),
    },
  };
}

async function createOdosEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<OdosEcosystem | undefined> {
  if (!ODOS_ROUTER_MAP[network]) {
    return undefined;
  }

  return {
    odosRouter: IOdosRouter__factory.connect(ODOS_ROUTER_MAP[network]!, signer),
  };
}

async function createParaswapEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<ParaswapEcosystem | undefined> {
  if (!PARASWAP_AUGUSTUS_ROUTER_MAP[network]) {
    return undefined;
  }

  return {
    augustusRouter: IParaswapAugustusRouter__factory.connect(PARASWAP_AUGUSTUS_ROUTER_MAP[network]!, signer),
    feeClaimer: IParaswapFeeClaimer__factory.connect(PARASWAP_FEE_CLAIMER_MAP[network]!, signer),
    transferProxy: PARASWAP_TRANSFER_PROXY_MAP[network]!,
  };
}

async function createPendleEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PendleEcosystem | undefined> {
  if (!PENDLE_PT_GLP_2024_MARKET_MAP[network]) {
    return undefined;
  }

  return {
    pendleRouter: getContract(
      PENDLE_ROUTER_MAP[network] as string,
      address => IPendleRouter__factory.connect(address, signer),
    ),
    ptGlpMarket: getContract(
      PENDLE_PT_GLP_2024_MARKET_MAP[network] as string,
      address => IPendlePtMarket__factory.connect(address, signer),
    ),
    ptGlpToken: getContract(
      PENDLE_PT_GLP_2024_TOKEN_MAP[network] as string,
      address => IPendlePtToken__factory.connect(address, signer),
    ),
    ptOracle: getContract(
      PENDLE_PT_ORACLE_MAP[network] as string,
      address => IPendlePtOracle__factory.connect(address, signer),
    ),
    syGlpToken: getContract(
      PENDLE_SY_GLP_2024_TOKEN_MAP[network] as string,
      address => IPendleSyToken__factory.connect(address, signer),
    ),
    ytGlpToken: getContract(
      PENDLE_YT_GLP_2024_TOKEN_MAP[network] as string,
      address => IPendleYtToken__factory.connect(address, signer),
    ),
    live: {
      pendleGLP2024Registry: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        IPendleGLPRegistry__factory.connect,
      ),
      pendleGLP2024RegistryProxy: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
      ),
      ptGlpIsolationModeFactory: getContract(
        (Deployments.PendlePtGLP2024IsolationModeVaultFactory as any)[network]?.address,
        IPendlePtGLP2024IsolationModeVaultFactory__factory.connect,
      ),
    },
  };
}

async function createPlutusEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PlutusEcosystem | undefined> {
  if (!PLV_GLP_MAP[network]) {
    return undefined;
  }

  const sGlpAddressForPlutus = '0x2F546AD4eDD93B956C8999Be404cdCAFde3E89AE';
  return {
    plvGlp: getContract(PLV_GLP_MAP[network] as string, address => IERC4626__factory.connect(address, signer)),
    plsToken: getContract(PLS_TOKEN_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
    plvGlpFarm: getContract(
      PLV_GLP_FARM_MAP[network] as string,
      address => IPlutusVaultGLPFarm__factory.connect(address, signer),
    ),
    plvGlpRouter: getContract(
      PLV_GLP_ROUTER_MAP[network] as string,
      address => IPlutusVaultGLPRouter__factory.connect(address, signer),
    ),
    sGlp: getContract(sGlpAddressForPlutus, address => IERC20__factory.connect(address, signer)),
    live: {
      dolomiteWhitelistForGlpDepositor: getContract(
        (Deployments.DolomiteWhitelistForGlpDepositorV2 as any)[network]?.address,
        address => DolomiteCompatibleWhitelistForPlutusDAO__factory.connect(address, signer),
      ),
      dolomiteWhitelistForPlutusChef: getContract(
        (Deployments.DolomiteWhitelistForPlutusChef as any)[network]?.address,
        address => DolomiteCompatibleWhitelistForPlutusDAO__factory.connect(address, signer),
      ),
      plutusVaultRegistry: getContract(
        (Deployments.PlutusVaultRegistryProxy as any)[network]?.address,
        IPlutusVaultRegistry__factory.connect,
      ),
      plvGlpIsolationModeFactory: getContract(
        (Deployments.PlutusVaultGLPIsolationModeVaultFactory as any)[network]?.address,
        IPlutusVaultGLPIsolationModeVaultFactory__factory.connect,
      ),
      plvGlpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect,
      ),
      plvGlpIsolationModeWrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect,
      ),
    },
  };
}

async function createUmamiEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<UmamiEcosystem | undefined> {
  if (!PLV_GLP_MAP[network]) {
    return undefined;
  }

  return {
    glpLink: getContract(
      UMAMI_LINK_VAULT_MAP[network] as string,
      address => IUmamiAssetVault__factory.connect(address, signer),
    ),
    glpUni: getContract(
      UMAMI_UNI_VAULT_MAP[network] as string,
      address => IUmamiAssetVault__factory.connect(address, signer),
    ),
    glpUsdc: getContract(
      UMAMI_USDC_VAULT_MAP[network] as string,
      address => IUmamiAssetVault__factory.connect(address, signer),
    ),
    glpWbtc: getContract(
      UMAMI_WBTC_VAULT_MAP[network] as string,
      address => IUmamiAssetVault__factory.connect(address, signer),
    ),
    glpWeth: getContract(
      UMAMI_WETH_VAULT_MAP[network] as string,
      address => IUmamiAssetVault__factory.connect(address, signer),
    ),
    storageViewer: getContract(
      UMAMI_STORAGE_VIEWER_MAP[network] as string,
      address => IUmamiAssetVaultStorageViewer__factory.connect(address, signer),
    ),
    configurator: await impersonateOrFallback(UMAMI_CONFIGURATOR_MAP[network] as string, true, signer),
  };
}

function getContract<T>(
  address: string,
  connector: (address: string, signerOrProvider: any) => T,
): T {
  return connector(address, undefined);
}

function getContractOpt<T>(
  address: string | undefined,
  connector: (address: string, signerOrProvider: any) => T,
): T | undefined {
  if (!address) {
    return undefined;
  }

  return connector(address, undefined);
}
