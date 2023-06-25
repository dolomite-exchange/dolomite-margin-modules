import { ApiToken } from '@dolomite-exchange/zap-sdk/dist';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
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
import { BaseContract, BigNumberish, ContractInterface } from 'ethers';
import { ethers, network } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import Deployments from '../../scripts/deployments.json';
import {
  AlwaysZeroInterestSetter,
  AlwaysZeroInterestSetter__factory,
  BorrowPositionProxyV2,
  BorrowPositionProxyV2__factory,
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  Expiry,
  Expiry__factory,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  IDepositWithdrawalProxy,
  IDepositWithdrawalProxy__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IERC20,
  IERC20__factory,
  IERC4626,
  IERC4626__factory,
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
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
  IJonesWhitelistController,
  IJonesWhitelistController__factory,
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
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPFarm__factory,
  IPlutusVaultGLPIsolationModeVaultFactory,
  IPlutusVaultGLPIsolationModeVaultFactory__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  ISGMX,
  ISGMX__factory,
  IWETH,
  IWETH__factory,
  LiquidatorAssetRegistry,
  LiquidatorAssetRegistry__factory,
  LiquidatorProxyV1,
  LiquidatorProxyV1__factory,
  LiquidatorProxyV1WithAmm,
  LiquidatorProxyV1WithAmm__factory,
  LiquidatorProxyV2WithExternalLiquidity,
  LiquidatorProxyV2WithExternalLiquidity__factory,
  LiquidatorProxyV3WithLiquidityToken,
  LiquidatorProxyV3WithLiquidityToken__factory,
  LiquidatorProxyV4WithGenericTrader,
  LiquidatorProxyV4WithGenericTrader__factory,
  ParaswapAggregatorTrader,
  ParaswapAggregatorTrader__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory,
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../src/types';
import {
  ALWAYS_ZERO_INTEREST_SETTER_MAP,
  ATLAS_SI_TOKEN_MAP,
  DFS_GLP_MAP,
  DPLV_GLP_MAP,
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
  MAGIC_GLP_MAP,
  PARASWAP_AUGUSTUS_ROUTER_MAP,
  PARASWAP_TRANSFER_PROXY_MAP,
  PENDLE_PT_GLP_2024_MARKET_MAP,
  PENDLE_PT_GLP_2024_TOKEN_MAP,
  PENDLE_PT_ORACLE_MAP,
  PENDLE_ROUTER_MAP,
  PENDLE_SY_GLP_2024_TOKEN_MAP,
  PLS_TOKEN_MAP,
  PLV_GLP_FARM_MAP,
  PLV_GLP_MAP,
  PLV_GLP_ROUTER_MAP,
  S_GLP_MAP,
  S_GMX_MAP,
  SBF_GMX_MAP,
  USDC_MAP,
  V_GLP_MAP,
  V_GMX_MAP,
  WETH_MAP,
} from '../../src/utils/constants';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
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

interface AbraEcosystem {
  magicGlp: IERC4626;
}

interface AtlasEcosystem {
  siToken: IERC20;
}

interface GmxEcosystem {
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

interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistController: IJonesWhitelistController;
  usdcReceiptToken: IERC4626;
  jUSDC: IERC4626;
  admin: SignerWithAddress;
}

interface ParaswapEcosystem {
  augustusRouter: address;
  transferProxy: address;
}

interface PendleEcosystem {
  pendleRouter: IPendleRouter;
  ptGlpMarket: IPendlePtMarket;
  ptGlpToken: IPendlePtToken;
  ptOracle: IPendlePtOracle;
  syGlpToken: IPendleSyToken;
}

interface PlutusEcosystem {
  plvGlp: IERC4626;
  plsToken: IERC20;
  plvGlpFarm: IPlutusVaultGLPFarm;
  plvGlpRouter: IPlutusVaultGLPRouter;
  sGlp: IERC20;
  live: {
    dolomiteWhitelistForGlpDepositor: DolomiteCompatibleWhitelistForPlutusDAO;
    dolomiteWhitelistForPlutusChef: DolomiteCompatibleWhitelistForPlutusDAO;
    plutusVaultRegistry: PlutusVaultRegistry;
    plvGlpIsolationModeFactory: IPlutusVaultGLPIsolationModeVaultFactory;
    plvGlpIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
    plvGlpIsolationModeWrapperTraderV1: PlutusVaultGLPIsolationModeWrapperTraderV1;
  };
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
  alwaysZeroInterestSetter: AlwaysZeroInterestSetter;
  atlasEcosystem: AtlasEcosystem | undefined;
  borrowPositionProxyV2: BorrowPositionProxyV2;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmFactory: IDolomiteAmmFactory;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  expiry: Expiry;
  gmxEcosystem: GmxEcosystem | undefined;
  jonesEcosystem: JonesEcosystem | undefined;
  liquidatorAssetRegistry: LiquidatorAssetRegistry;
  liquidatorProxyV1: LiquidatorProxyV1;
  liquidatorProxyV1WithAmm: LiquidatorProxyV1WithAmm;
  liquidatorProxyV2: LiquidatorProxyV2WithExternalLiquidity | undefined;
  liquidatorProxyV3: LiquidatorProxyV3WithLiquidityToken | undefined;
  liquidatorProxyV4: LiquidatorProxyV4WithGenericTrader;
  paraswapEcosystem: ParaswapEcosystem | undefined;
  paraswapTrader: ParaswapAggregatorTrader | undefined;
  pendleEcosystem: PendleEcosystem | undefined;
  plutusEcosystem: PlutusEcosystem | undefined;
  testInterestSetter: TestInterestSetter | undefined;
  testPriceOracle: TestPriceOracle | undefined;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  marketIds: {
    dfsGlp: BigNumberish | undefined;
    dplvGlp: BigNumberish | undefined;
    magicGlp: BigNumberish | undefined;
    usdc: BigNumberish;
    weth: BigNumberish;
  };
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  dfsGlp: IERC20 | undefined;
  usdc: IERC20;
  weth: IWETH;
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
  await core.weth.connect(signer).deposit({ value: amount });
  await core.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.usdc.connect(whaleSigner).transfer(signer.address, amount);
  await core.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
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

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber, config.network);
  } else {
    console.log('Skipping forking...');
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

  const alwaysZeroInterestSetter = AlwaysZeroInterestSetter__factory.connect(
    ALWAYS_ZERO_INTEREST_SETTER_MAP[config.network],
    governance,
  );

  const borrowPositionProxyV2 = BorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
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

  const expiry = Expiry__factory.connect(
    ExpiryJson.networks[config.network].address,
    governance,
  );

  const liquidatorAssetRegistry = LiquidatorAssetRegistry__factory.connect(
    LiquidatorAssetRegistryJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1 = LiquidatorProxyV1__factory.connect(
    LiquidatorProxyV1Json.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1WithAmm = LiquidatorProxyV1WithAmm__factory.connect(
    LiquidatorProxyV1WithAmmJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV2 = getContractOpt(
    (LiquidatorProxyV2WithExternalLiquidityJson.networks as any)[config.network]?.address,
    LiquidatorProxyV2WithExternalLiquidity__factory.connect,
  );

  const liquidatorProxyV3 = getContractOpt(
    (LiquidatorProxyV3WithLiquidityTokenJson.networks as any)[config.network]?.address,
    LiquidatorProxyV3WithLiquidityToken__factory.connect,
  );

  const liquidatorProxyV4 = getContract(
    (LiquidatorProxyV4WithGenericTraderJson.networks as any)[config.network].address,
    LiquidatorProxyV4WithGenericTrader__factory.connect,
  );

  const paraswapTrader = getContractOpt(
    (Deployments.ParaswapAggregatorTrader as any)[config.network]?.address,
    ParaswapAggregatorTrader__factory.connect,
  );

  const { testInterestSetter, testPriceOracle } = await getTestContracts();

  const abraEcosystem = await createAbraEcosystem(config.network, hhUser1);
  const atlasEcosystem = await createAtlasEcosystem(config.network, hhUser1);
  const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);
  const jonesEcosystem = await createJonesEcosystem(config.network, hhUser1);
  const paraswapEcosystem = await createParaswapEcosystem(config.network);
  const pendleEcosystem = await createPendleEcosystem(config.network, hhUser1);
  const plutusEcosystem = await createPlutusEcosystem(config.network, hhUser1);

  return {
    abraEcosystem,
    alwaysZeroInterestSetter,
    atlasEcosystem,
    borrowPositionProxyV2,
    depositWithdrawalProxy,
    dolomiteAmmFactory,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    expiry,
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
    paraswapEcosystem,
    paraswapTrader,
    pendleEcosystem,
    plutusEcosystem,
    testInterestSetter,
    testPriceOracle,
    config: {
      blockNumber: config.blockNumber,
      network: config.network,
    },
    apiTokens: {
      usdc: {
        marketId: USDC_MAP[config.network].marketId,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        tokenAddress: USDC_MAP[config.network].address,
      },
      weth: {
        marketId: WETH_MAP[config.network].marketId,
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        tokenAddress: WETH_MAP[config.network].address,
      },
    },
    marketIds: {
      dfsGlp: DFS_GLP_MAP[config.network]?.marketId,
      dplvGlp: DPLV_GLP_MAP[config.network]?.marketId,
      magicGlp: MAGIC_GLP_MAP[config.network]?.marketId,
      usdc: USDC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
    },
    dfsGlp: createIERC20Opt(DFS_GLP_MAP[config.network]?.address, hhUser1),
    usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
    weth: IWETH__factory.connect(WETH_MAP[config.network].address, hhUser1),
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
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    (priceOracle ?? core.testPriceOracle)!.address,
    core.testInterestSetter!.address,
    { value: 0 },
    { value: 0 },
    0,
    isClosing,
    false,
  );
}

async function getTestContracts(): Promise<{
  testPriceOracle?: TestPriceOracle;
  testInterestSetter?: TestInterestSetter
}> {
  let testInterestSetter: TestInterestSetter;
  let testPriceOracle: TestPriceOracle;
  if (network.name === 'hardhat') {
    testInterestSetter = await createContractWithAbi<TestInterestSetter>(
      TestInterestSetter__factory.abi,
      TestInterestSetter__factory.bytecode,
      [],
    );
    testPriceOracle = await createContractWithAbi<TestPriceOracle>(
      TestPriceOracle__factory.abi,
      TestPriceOracle__factory.bytecode,
      [],
    );
  } else {
    testInterestSetter = null as any;
    testPriceOracle = null as any;
  }

  return { testInterestSetter, testPriceOracle };
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
        (Deployments.GmxRegistryV1 as any)[network]?.address,
        IGmxRegistryV1__factory.connect,
      ),
    },
  };
}

async function createParaswapEcosystem(
  network: Network,
): Promise<ParaswapEcosystem | undefined> {
  if (!PARASWAP_AUGUSTUS_ROUTER_MAP[network]) {
    return undefined;
  }

  return {
    augustusRouter: PARASWAP_AUGUSTUS_ROUTER_MAP[network]!,
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
        (Deployments.PlutusVaultRegistry as any)[network]?.address,
        PlutusVaultRegistry__factory.connect,
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
