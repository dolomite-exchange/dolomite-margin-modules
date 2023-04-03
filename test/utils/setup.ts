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
import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface } from 'ethers';
import { ethers, network } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import {
  BorrowPositionProxyV2,
  BorrowPositionProxyV2__factory,
  Expiry,
  Expiry__factory,
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
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardsRouterV2,
  IGLPRewardsRouterV2__factory,
  IGmxRewardRouterV2,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester,
  IGmxVester__factory,
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
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../src/types';
import {
  ATLAS_SI_TOKEN_MAP,
  ES_GMX_DISTRIBUTOR_MAP,
  ES_GMX_MAP,
  FS_GLP_MAP,
  GLP_MANAGER_MAP,
  GLP_MAP,
  GLP_REWARD_ROUTER_MAP,
  GMX_MAP,
  GMX_REWARD_ROUTER_MAP,
  GMX_VAULT_MAP,
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
  gmxRewardsRouter: IGmxRewardRouterV2;
  gmx: IERC20;
  gmxVault: IGmxVault;
  sGlp: IERC20;
  sGmx: ISGMX;
  sbfGmx: IERC20;
  vGlp: IGmxVester;
  vGmx: IGmxVester;
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
  atlasEcosystem: AtlasEcosystem | undefined;
  borrowPositionProxyV2: BorrowPositionProxyV2;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmFactory: IDolomiteAmmFactory;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  expiry: Expiry;
  /**
   * These contracts are only available on Arbitrum One as of now.
   */
  gmxEcosystem: GmxEcosystem | undefined;
  liquidatorAssetRegistry: LiquidatorAssetRegistry | undefined;
  liquidatorProxyV1: LiquidatorProxyV1;
  liquidatorProxyV1WithAmm: LiquidatorProxyV1WithAmm;
  liquidatorProxyV2: LiquidatorProxyV2WithExternalLiquidity | undefined;
  liquidatorProxyV3: LiquidatorProxyV3WithLiquidityToken | undefined;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  marketIds: {
    usdc: BigNumberish;
    weth: BigNumberish;
  };
  usdc: IERC20;
  weth: IWETH;
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

  const atlasEcosystem = await createAtlasEcosystem(config.network, hhUser1);
  const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);

  return {
    atlasEcosystem,
    borrowPositionProxyV2,
    depositWithdrawalProxy,
    dolomiteAmmFactory,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    expiry,
    gmxEcosystem,
    governance,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV1WithAmm,
    liquidatorProxyV2,
    liquidatorProxyV3,
    testInterestSetter,
    testPriceOracle,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    config: {
      blockNumber: config.blockNumber,
      network: config.network,
    },
    marketIds: {
      usdc: USDC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
    },
    usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
    weth: IWETH__factory.connect(WETH_MAP[config.network].address, hhUser1),
  };
}

export async function setupTestMarket(
  core: CoreProtocol,
  token: { address: address },
  isClosing: boolean,
  priceOracle?: { address: address },
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    (priceOracle ?? core.testPriceOracle).address,
    core.testInterestSetter.address,
    { value: 0 },
    { value: 0 },
    0,
    isClosing,
    false,
  );
}

async function createAtlasEcosystem(network: Network, signer: SignerWithAddress): Promise<AtlasEcosystem | undefined> {
  if (!ATLAS_SI_TOKEN_MAP[network]) {
    return undefined;
  }

  return {
    siToken: getContract(ATLAS_SI_TOKEN_MAP[network] as string, address => IERC20__factory.connect(address, signer)),
  };
}

async function createGmxEcosystem(network: Network, signer: SignerWithAddress): Promise<GmxEcosystem | undefined> {
  const esGmxDistributorAddress = ES_GMX_DISTRIBUTOR_MAP[network];
  if (!esGmxDistributorAddress) {
    return undefined;
  }

  const esGmxDistributor = getContract(esGmxDistributorAddress, IEsGmxDistributor__factory.connect);
  const esGmxAdmin = esGmxDistributor
    ? await impersonateOrFallback(await esGmxDistributor.connect(signer).admin(), true, signer)
    : undefined;
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
