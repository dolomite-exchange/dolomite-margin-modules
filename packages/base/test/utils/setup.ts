import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import ModuleDeployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  ChainsightPriceOracleV3__factory,
  ChroniclePriceOracleV3__factory,
  IChainlinkAutomationRegistry__factory,
  IChainlinkPriceOracleV3__factory,
  IChaosLabsPriceOracleV3__factory,
  OkxPriceOracleV3__factory,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as LiquidatorAssetRegistryJson from '@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json';
import * as LiquidatorProxyV1Json from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json';
import * as LiquidatorProxyV4WithGenericTraderJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV4WithGenericTrader.json';
import { address } from '@dolomite-margin/dist/src';
import { Provider } from '@ethersproject/providers';
import ZapBigNumber from 'bignumber.js';
import { BaseContract, BigNumber, BigNumberish, ContractInterface, Signer } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network as hardhatNetwork } from 'hardhat';
import {
  DolomiteOwnerV1__factory,
  DolomiteOwnerV2__factory,
  IAdminClaimExcessTokens__factory, IAdminPauseMarket__factory,
} from 'packages/admin/src/types';
import { IGlvToken } from 'packages/glv/src/types';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';
import { IMantleRewardStation__factory } from 'packages/mantle/src/types';
import { IChainlinkPriceOracleV1__factory } from 'packages/oracles/src/types';
import {
  DolomiteERC20__factory,
  DolomiteERC20WithPayable__factory,
  DolomiteERC4626,
  DolomiteERC4626__factory,
  DolomiteERC4626WithPayable,
  DolomiteERC4626WithPayable__factory,
  IBorrowPositionProxyV2__factory,
  IBorrowPositionRouter__factory,
  IDepositWithdrawalProxy__factory,
  IDepositWithdrawalRouter__factory,
  IDolomiteAccountRegistry__factory,
  IDolomiteAccountRiskOverrideSetter__factory,
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
  IGenericTraderProxyV2__factory,
  IGenericTraderRouter__factory,
  ILiquidatorAssetRegistry__factory,
  ILiquidatorProxyV1__factory,
  ILiquidatorProxyV4WithGenericTrader__factory,
  IPartiallyDelayedMultiSig__factory,
  IsolationModeFreezableLiquidatorProxy__factory,
  IWETH__factory,
  LiquidatorProxyV6__factory,
  RegistryProxy__factory,
} from '../../src/types';
import {
  AAVE_MAP,
  ARB_MAP,
  BERA_ETH_MAP, BGT_MAP,
  BTC_PLACEHOLDER_MAP,
  CHAINLINK_AUTOMATION_REGISTRY_MAP,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  CHAINLINK_PRICE_ORACLE_V1_MAP,
  CM_ETH_MAP,
  D_ARB_MAP,
  D_GLV_BTC_MAP,
  D_GLV_ETH_MAP,
  D_GM_AAVE_USD_MAP,
  D_GM_ARB_USD_MAP,
  D_GM_BTC_MAP,
  D_GM_BTC_USD_MAP,
  D_GM_DOGE_USD_MAP,
  D_GM_ETH_MAP,
  D_GM_ETH_USD_MAP,
  D_GM_GMX_MAP,
  D_GM_GMX_USD_MAP,
  D_GM_LINK_USD_MAP,
  D_GM_PENDLE_USD_MAP,
  D_GM_PEPE_USD_MAP,
  D_GM_SOL_USD_MAP,
  D_GM_UNI_USD_MAP,
  D_GM_WIF_USD_MAP,
  D_GM_WST_ETH_USD_MAP,
  D_GMX_MAP, D_IBGT_MAP,
  DAI_MAP,
  DE_USD_MAP,
  DFS_GLP_MAP,
  DJ_USDC_V1,
  DJ_USDC_V2,
  DOLO_MAP, DOLOMITE_DAO_GNOSIS_SAFE_MAP,
  DPLV_GLP_MAP,
  DPT_EZ_ETH_JUN_2024_MAP,
  DPT_EZ_ETH_SEP_2024_MAP,
  DPT_GLP_MAR_2024_MAP,
  DPT_R_ETH_JUN_2025_MAP,
  DPT_RS_ETH_SEP_2024_MAP,
  DPT_WE_ETH_APR_2024_MAP,
  DPT_WE_ETH_JUN_2024_MAP,
  DPT_WE_ETH_SEP_2024_MAP,
  DPT_WST_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2025_MAP,
  DPX_MAP,
  DYT_GLP_2024_MAP,
  E_BTC_MAP,
  E_ETH_MAP,
  E_USD_MAP,
  ETH_PLUS_MAP,
  EZ_ETH_MAP,
  EZ_ETH_REVERSED_MAP,
  FBTC_MAP,
  FRAX_MAP,
  GMX_MAP,
  GNOSIS_SAFE_MAP,
  GRAI_MAP,
  GRAIL_MAP,
  HENLO_MAP,
  HONEY_MAP,
  IBERA_MAP,
  IBGT_MAP,
  JONES_MAP,
  LBTC_MAP,
  LINK_MAP,
  MAGIC_GLP_MAP,
  MAGIC_MAP,
  MANTLE_REWARD_STATION_MAP,
  MATIC_MAP,
  METH_MAP,
  MIM_MAP,
  NATIVE_USDC_MAP,
  NECT_MAP,
  OHM_MAP,
  PAYABLE_TOKEN_MAP,
  PENDLE_MAP,
  POL_MAP,
  PREMIA_MAP,
  PUMP_BTC_MAP,
  R_ETH_MAP,
  R_USD_MAP,
  RDNT_MAP,
  RS_ETH_MAP,
  RS_ETH_REVERSED_MAP,
  RSW_ETH_MAP,
  S_GLP_MAP,
  S_USDA_MAP,
  S_USDE_MAP,
  S_USDS_MAP,
  SDE_USD_MAP,
  SIZE_MAP,
  SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
  SOL_MAP,
  SOLV_BTC_MAP,
  SR_USD_MAP,
  ST_BTC_MAP,
  ST_ETH_MAP,
  STONE_BTC_MAP,
  STONE_MAP,
  TBTC_MAP,
  UNI_BTC_MAP,
  UNI_MAP,
  USD0_MAP,
  USD0PP_MAP,
  USDA_MAP,
  USDC_MAP,
  USDE_MAP,
  USDL_MAP,
  USDM_MAP,
  USDS_MAP,
  USDT_MAP,
  USDY_MAP,
  W_USDL_MAP,
  W_USDM_MAP,
  WBERA_MAP,
  WBTC_MAP,
  WE_ETH_MAP,
  WETH_MAP,
  WMNT_MAP,
  WO_ETH_MAP,
  WOKB_MAP,
  WST_ETH_MAP,
  X_SOLV_BTC_MAP,
  XAI_MAP,
  YL_FBTC_MAP,
  YL_PUMP_BTC_MAP,
  YL_ST_ETH_MAP,
} from '../../src/utils/constants';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  DolomiteNetwork,
  Network,
  NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP,
} from '../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';
import {
  CoreProtocolAbstract,
  CoreProtocolParams,
  DolomiteWETHType,
  ImplementationContracts,
  LibraryMaps,
  WETHType,
} from './core-protocols/core-protocol-abstract';
import { CoreProtocolArbitrumOne } from './core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolBase } from './core-protocols/core-protocol-base';
import { CoreProtocolBerachain } from './core-protocols/core-protocol-berachain';
import { CoreProtocolMantle, CoreProtocolParamsMantle } from './core-protocols/core-protocol-mantle';
import { CoreProtocolPolygonZkEvm } from './core-protocols/core-protocol-polygon-zkevm';
import { CoreProtocolXLayer } from './core-protocols/core-protocol-x-layer';
import { DolomiteMargin, Expiry } from './dolomite';
import { createAbraEcosystem } from './ecosystem-utils/abra';
import { createArbEcosystem } from './ecosystem-utils/arb';
import { createCamelotEcosystem } from './ecosystem-utils/camelot';
import { DeployedVault, getDeployedVaults } from './ecosystem-utils/deployed-vaults';
import { createGlvEcosystem } from './ecosystem-utils/glv';
import { createGmxEcosystem, createGmxEcosystemV2 } from './ecosystem-utils/gmx';
import { createInterestSetters } from './ecosystem-utils/interest-setters';
import { createJonesEcosystem } from './ecosystem-utils/jones';
import {
  createGoARBLiquidityMiningEcosystem,
  createMineralLiquidityMiningEcosystem,
  createOARBLiquidityMiningEcosystem,
} from './ecosystem-utils/liquidity-mining';
import { createOdosEcosystem } from './ecosystem-utils/odos';
import { createOkxEcosystem } from './ecosystem-utils/okx';
import { createOogaBoogaEcosystem } from './ecosystem-utils/ooga-booga';
import { createParaswapEcosystem } from './ecosystem-utils/paraswap';
import { createPendleEcosystemArbitrumOne, createPendleEcosystemMantle } from './ecosystem-utils/pendle';
import { createPlutusEcosystem } from './ecosystem-utils/plutus';
import { createPremiaEcosystem } from './ecosystem-utils/premia';
import { createTestEcosystem } from './ecosystem-utils/testers';
import { createUmamiEcosystem } from './ecosystem-utils/umami';
import { getRealLatestBlockNumber, impersonate, impersonateOrFallback, resetForkIfPossible } from './index';
import { readDeploymentFile } from '@dolomite-exchange/modules-deployments/src/utils/deploy-utils';
import { createBerachainRewardsEcosystem } from './ecosystem-utils/berachain-rewards';
import { createTokenomicsEcosystem } from './ecosystem-utils/tokenomics';
import { createTokenomicsAirdropEcosystem } from './ecosystem-utils/tokenomics-airdrop';
import { IBGT__factory } from 'packages/berachain/src/types';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig<T extends DolomiteNetwork> {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  readonly blockNumber: number;
  readonly network: T;
  readonly skipForking?: boolean;
  readonly isLatest?: boolean;
}

export interface CoreProtocolConfigParent<T extends DolomiteNetwork> {
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

interface CoreProtocolConfigBerachain extends CoreProtocolConfigParent<Network.Berachain> {
  readonly berachain: boolean;
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

export type CoreProtocolConfig<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
  ? CoreProtocolConfigArbitrumOne
  : T extends Network.Base
    ? CoreProtocolConfigBase
    : T extends Network.Berachain
      ? CoreProtocolConfigBerachain
      : T extends Network.Mantle
        ? CoreProtocolConfigMantle
        : T extends Network.PolygonZkEvm
          ? CoreProtocolConfigPolygonZkEvm
          : T extends Network.XLayer
            ? CoreProtocolConfigXLayer
            : never;

export async function disableInterestAccrual<T extends DolomiteNetwork>(
  core: CoreProtocolAbstract<T>,
  marketId: BigNumberish,
) {
  return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.interestSetters.alwaysZeroInterestSetter.address);
}

export async function enableInterestAccrual<T extends DolomiteNetwork>(
  core: CoreProtocolAbstract<T>,
  marketId: BigNumberish,
) {
  return core.dolomiteMargin.ownerSetInterestSetter(
    marketId,
    core.interestSetters.linearStepFunction8L92U90OInterestSetter.address,
  );
}

export async function setupWBERABalance(
  core: CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  await core.tokens.wbera.connect(signer).deposit({ value: amount });
  await core.tokens.wbera.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWETHBalance<T extends DolomiteNetwork>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  if ('deposit' in core.tokens.weth) {
    await core.tokens.weth.connect(signer).deposit({ value: amount });
    await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
  } else if (core.network === Network.XLayer) {
    const whaleAddress = '0x2d22604d6bbf51839c404aef5c65443e424e0945';
    const whaleSigner = await impersonate(whaleAddress, true);
    await core.tokens.weth.connect(whaleSigner).transfer(signer.address, amount);
    await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
  } else if (core.network === Network.Berachain) {
    const whaleAddress = '0x8382FBcEbef31dA752c72885A61d4416F342c6C8';
    const whaleSigner = await impersonate(whaleAddress, true);
    await core.tokens.weth.connect(whaleSigner).transfer(signer.address, amount);
    await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
  } else {
    return Promise.reject(new Error(`Cannot setup WETH balance on ${core.network}`));
  }
}

export async function setupWMNTBalance(
  core: CoreProtocolParamsMantle,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  await impersonate(signer, true, BigNumber.from(amount).add(parseEther('1')));
  await core.tokens.wmnt.connect(signer).deposit({ value: amount });
  await core.tokens.wmnt.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWBTCBalance<T extends DolomiteNetwork>(
  core: CoreProtocolArbitrumOne | CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  let whaleAddress;
  if (core.network === Network.ArbitrumOne) {
    whaleAddress = '0x078f358208685046a11c85e8ad32895ded33a249'; // Aave Token
  } else if (core.network === Network.Berachain) {
    whaleAddress = '0x46fcd35431f5B371224ACC2e2E91732867B1A77e';
  } else {
    throw new Error('Invalid network for WBTC');
  }
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

export async function setupHONEYBalance(
  core: CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x9EB897D400f245E151daFD4c81176397D7798C9c';
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.honey.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.honey.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
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

export async function setupUSDCBalance<T extends DolomiteNetwork>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  let whaleAddress: string;
  if (core.network === Network.Berachain) {
    whaleAddress = '0xBD8DFf36a635B951e008E414ED73021869324Fd7';
  } else if (core.network === Network.XLayer) {
    whaleAddress = '0x2d22604d6bbf51839c404aef5c65443e424e0945';
  } else if (core.network === Network.Berachain) {
    whaleAddress = '0x4Be03f781C497A489E3cB0287833452cA9B9E80B'; // BEX vault
    const whaleSigner = await impersonate(whaleAddress, true);
    await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
    await core.tokens.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
  } else {
    whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  }
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDMBalance(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x4bD135524897333bec344e50ddD85126554E58B4';
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdm.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdm.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDTBalance(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x6ab707Aca953eDAeFBc4fD23bA73294241490620'; // Aave token
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdt.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdt.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupGMBalance(
  core: CoreProtocolArbitrumOne,
  gmToken: IGmxMarketToken,
  signer: { address: string },
  amount: BigNumberish,
  spender?: { address: string },
) {
  const controller = await impersonate(core.gmxV2Ecosystem!.gmxExchangeRouter.address, true);
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

export async function setupGLVBalance(
  core: CoreProtocolArbitrumOne,
  glvToken: IGlvToken,
  signer: { address: string },
  amount: BigNumberish,
  spender?: { address: string },
) {
  const controller = await impersonate(core.gmxV2Ecosystem!.gmxExchangeRouter.address, true);
  await glvToken.connect(controller).mint(signer.address, amount);
  if (signer instanceof SignerWithAddressWithSafety && spender) {
    await glvToken.connect(signer).approve(spender.address, amount);
  }
}

export async function setupRsEthBalance(
  core: CoreProtocolBerachain | CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  let whaleAddress;
  if (core.network === Network.ArbitrumOne) {
    whaleAddress = '0xf176fb51f4eb826136a54fdc71c50fcd2202e272'; // Balancer Vault
  } else if (core.network === Network.Berachain) {
    whaleAddress = '0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D';
  } else {
    throw new Error('Invalid network for weETH');
  }
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

export async function setupRUsdBalance(
  core: CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xD6D83e479359766f21A63b20d6AF43A138356EbA'; // Rusd oft
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.rUsd!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.rUsd!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupSolvBtcBalance(
  core: CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x26666a82cfE70E1aD048939708cA3ACc4982cF9F';
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.solvBtc!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.solvBtc!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDEBalance<T extends DolomiteNetwork>(
  core: CoreProtocolBerachain | CoreProtocolArbitrumOne,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  let whaleAddress;
  if (core.network === Network.ArbitrumOne) {
    whaleAddress = '0x5B9e411c9E50164133DE07FE1cAC05A094000105'; // Pendle SY Token
  } else if (core.network === Network.Berachain) {
    whaleAddress = '0x9E4C460645B39628C631003eB9911651d5441DD8'; // Uniswap pool
  } else {
    throw new Error('Invalid network for USDe');
  }
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usde!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usde!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWeEthBalance(
  core: CoreProtocolArbitrumOne | CoreProtocolBerachain,
  signer: SignerWithAddressWithSafety,
  amount: BigNumberish,
  spender: { address: string },
) {
  let whaleAddress;
  if (core.network === Network.ArbitrumOne) {
    whaleAddress = '0xa6c895eb332e91c5b3d00b7baeeaae478cc502da'; // Balancer Vault
  } else if (core.network === Network.Berachain) {
    whaleAddress = '0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D';
  } else {
    throw new Error('Invalid network for weEth');
  }
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

export function getDefaultCoreProtocolConfig<T extends DolomiteNetwork>(network: T): CoreProtocolConfig<T> {
  return getCoreProtocolConfig(network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network]);
}

function getCoreProtocolConfig<T extends DolomiteNetwork>(network: T, blockNumber: number): CoreProtocolConfig<T> {
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

  if (network === Network.Berachain) {
    return {
      network,
      blockNumber,
      networkNumber: parseInt(network, 10),
      berachain: true,
    } as CoreProtocolConfigBerachain as any;
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

export function getDefaultProtocolConfigForGlv(): CoreProtocolConfig<Network.ArbitrumOne> {
  return {
    network: Network.ArbitrumOne,
    networkNumber: parseInt(Network.ArbitrumOne, 10),
    blockNumber: 279_600_000,
    arbitrumOne: true,
  };
}

export function getDefaultCoreProtocolConfigForGmxV2(): CoreProtocolConfig<Network.ArbitrumOne> {
  return {
    network: Network.ArbitrumOne,
    networkNumber: parseInt(Network.ArbitrumOne, 10),
    blockNumber: 247_305_500,
    arbitrumOne: true,
  };
}

export type CoreProtocolType<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
  ? CoreProtocolArbitrumOne
  : T extends Network.Base
    ? CoreProtocolBase
    : T extends Network.Berachain
      ? CoreProtocolBerachain
      : T extends Network.Mantle
        ? CoreProtocolMantle
        : T extends Network.PolygonZkEvm
          ? CoreProtocolPolygonZkEvm
          : T extends Network.XLayer
            ? CoreProtocolXLayer
            : never;

export function getDolomiteMarginContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): DolomiteMargin<T> {
  return (
    config.network === Network.ArbitrumOne
      ? IDolomiteMargin__factory.connect(DolomiteMarginJson.networks[config.network].address, signer)
      : IDolomiteMarginV2__factory.connect(DolomiteMarginJson.networks[config.network].address, signer)
  ) as DolomiteMargin<T>;
}

export function getExpiryContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): Expiry<T> {
  return (
    config.network === Network.ArbitrumOne
      ? IExpiry__factory.connect(ExpiryJson.networks[config.network].address, signer)
      : IExpiryV2__factory.connect(ExpiryJson.networks[config.network].address, signer)
  ) as Expiry<T>;
}

export function getWethContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): WETHType<T> {
  switch (config.network) {
    case Network.ArbitrumOne:
    case Network.Base:
    case Network.Ink:
    case Network.PolygonZkEvm:
    case Network.SuperSeed:
      return IWETH__factory.connect(WETH_MAP[config.network].address, signer) as WETHType<T>;
    case Network.Berachain:
    case Network.Mantle:
    case Network.XLayer:
      return IERC20__factory.connect(WETH_MAP[config.network].address, signer) as WETHType<T>;
    default:
      // This would be an error as we have a network type that isn't accounted for
      throw new Error(`Unsupported network type: ${config.network}`);
  }
}

export function getDolomite4626TokenContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
  deploymentKey: keyof typeof ModuleDeployments,
): DolomiteERC4626 {
  return DolomiteERC4626__factory.connect((ModuleDeployments[deploymentKey] as any)[config.network]!.address, signer);
}

export function getDolomite4626WithPayableTokenContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
  deploymentKey: keyof typeof ModuleDeployments,
): DolomiteERC4626WithPayable {
  return DolomiteERC4626WithPayable__factory.connect(
    (ModuleDeployments[deploymentKey] as any)[config.network]!.address,
    signer,
  );
}

export async function gatherAllDolomite4626TokenContracts<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): Promise<(DolomiteERC4626 | DolomiteERC4626WithPayable)[]> {
  let payableFound = false;
  const dTokens: (DolomiteERC4626 | DolomiteERC4626WithPayable)[] = [];

  const keys = Object.keys(ModuleDeployments);
  for (const key of keys) {
    const deployments = ModuleDeployments as any;
    if (deployments[key][config.network] && key.startsWith('Dolomite') && key.endsWith('4626Token')) {
      const deploymentValue = deployments[key][config.network];
      const address = deploymentValue.address;
      if (hardhatNetwork.name === 'hardhat' && !config.isLatest) {
        const code = await ethers.provider.getCode(address);
        if (code === BYTES_EMPTY) {
          console.warn(`\tCode not found for dToken (${key}) with address ${address}. Skipping dToken gathering...`);
          return [];
        }
      }

      if ('isPayable' in deploymentValue && deploymentValue.isPayable) {
        payableFound = true;
        dTokens.push(DolomiteERC4626WithPayable__factory.connect(address, signer));
      } else {
        dTokens.push(DolomiteERC4626__factory.connect(address, signer));
      }
    }
  }

  if (!payableFound && dTokens.length > 0) {
    return Promise.reject(new Error('No payable dToken found.'));
  }

  return dTokens;
}

export function getDolomiteWeth4626TokenContract<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  signer: SignerWithAddressWithSafety,
): DolomiteWETHType<T> | undefined {
  const address = (ModuleDeployments.DolomiteWeth4626Token as any)[config.network as any]?.address;
  switch (config.network) {
    case Network.ArbitrumOne:
    case Network.Base:
    case Network.Ink:
    case Network.PolygonZkEvm:
    case Network.SuperSeed:
      return getContractOpt(address, DolomiteERC4626WithPayable__factory.connect, signer) as DolomiteWETHType<T>;
    case Network.Berachain:
    case Network.Mantle:
    case Network.XLayer:
      return getContractOpt(address, DolomiteERC4626__factory.connect, signer) as DolomiteWETHType<T>;
    default:
      // This would be an error as we have a network type that isn't accounted for
      throw new Error(`Unsupported network type: ${config.network}`);
  }
}

export async function setupCoreProtocol<T extends DolomiteNetwork>(
  config: Readonly<CoreProtocolSetupConfig<T>>,
): Promise<CoreProtocolType<T>> {
  if (!config.skipForking) {
    await resetForkIfPossible(config.blockNumber, config.network);
  }

  const realLatest = await getRealLatestBlockNumber(true, config.network);
  (config as any).isLatest = realLatest - config.blockNumber < 1_000;

  const dolomiteMarginAddress = DolomiteMarginJson.networks[config.network].address;
  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await Promise.all(
    (await ethers.getSigners()).map((s) => SignerWithAddressWithSafety.create(s.address)),
  );
  if (!hhUser1) {
    return Promise.reject(
      new Error('No signer found for Hardhat User #1. Check your environment variables for DEPLOYER_PRIVATE_KEY!'),
    );
  }

  const daoAddress = DOLOMITE_DAO_GNOSIS_SAFE_MAP[config.network];
  const gnosisSafeAddress = GNOSIS_SAFE_MAP[config.network];
  const gnosisSafe: SignerWithAddressWithSafety = await impersonateOrFallback(gnosisSafeAddress, true, hhUser1);

  const governanceAddress = await IDolomiteMargin__factory.connect(dolomiteMarginAddress, hhUser1).owner();
  const governance: SignerWithAddressWithSafety = await impersonateOrFallback(governanceAddress, true, hhUser1);

  const dolomiteMargin = getDolomiteMarginContract<T>(config, governance);

  const adminClaimExcessTokens = IAdminClaimExcessTokens__factory.connect(
    ModuleDeployments.AdminClaimExcessTokensV1[config.network].address,
    governance,
  );

  const adminPauseMarket = IAdminPauseMarket__factory.connect(
    ModuleDeployments.AdminPauseMarketV1[config.network].address,
    governance,
  );

  const borrowPositionProxyV2 = IBorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
  );

  const borrowPositionRouter = IBorrowPositionRouter__factory.connect(
    ModuleDeployments.BorrowPositionRouterProxy[config.network].address,
    governance,
  );

  const chainlinkPriceOracleV1 = getContract(
    CHAINLINK_PRICE_ORACLE_V1_MAP[config.network],
    IChainlinkPriceOracleV1__factory.connect,
    governance,
  );

  const chainlinkPriceOracleV3 = getContract(
    ModuleDeployments.ChainlinkPriceOracleV3[config.network]?.address,
    IChainlinkPriceOracleV3__factory.connect,
    governance,
  );

  const delayedMultiSig = IPartiallyDelayedMultiSig__factory.connect(
    CoreDeployments.PartiallyDelayedMultiSig[config.network].address,
    gnosisSafe,
  );

  const depositWithdrawalProxy = IDepositWithdrawalProxy__factory.connect(
    DepositWithdrawalProxyJson.networks[config.network].address,
    governance,
  );

  const depositWithdrawalRouter = IDepositWithdrawalRouter__factory.connect(
    ModuleDeployments.DepositWithdrawalRouterProxy[config.network].address,
    governance,
  );

  const dolomiteRegistry = IDolomiteRegistry__factory.connect(
    ModuleDeployments.DolomiteRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteRegistryProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRegistry = IDolomiteAccountRegistry__factory.connect(
    ModuleDeployments.DolomiteAccountRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRegistryProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteAccountRegistryProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRiskOverrideSetter = IDolomiteAccountRiskOverrideSetter__factory.connect(
    ModuleDeployments.DolomiteAccountRiskOverrideSetterProxy[config.network].address,
    governance,
  );

  const dolomiteAccountRiskOverrideSetterProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteAccountRiskOverrideSetterProxy[config.network].address,
    governance,
  );

  const eventEmitterRegistry = getContract(
    ModuleDeployments.EventEmitterRegistryProxy[config.network].address,
    IEventEmitterRegistry__factory.connect,
    governance,
  );

  const eventEmitterRegistryProxy = getContract(
    ModuleDeployments.EventEmitterRegistryProxy[config.network].address,
    RegistryProxy__factory.connect,
    governance,
  );

  const expiry = getExpiryContract<T>(config, governance);

  const freezableLiquidatorProxy = IsolationModeFreezableLiquidatorProxy__factory.connect(
    getMaxDeploymentVersionAddressByDeploymentKey('IsolationModeFreezableLiquidatorProxy', config.network),
    governance,
  );

  const genericTraderProxy = getContract(
    ModuleDeployments.GenericTraderProxyV2[config.network].address,
    IGenericTraderProxyV2__factory.connect,
    governance,
  );

  const genericTraderRouter = getContract(
    ModuleDeployments.GenericTraderRouterProxy[config.network].address,
    IGenericTraderRouter__factory.connect,
    governance,
  );

  const implementationContracts = createImplementationContracts(config.network, hhUser1);

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

  const liquidatorProxyV6 = getContract(
    ModuleDeployments.LiquidatorProxyV6[config.network].address,
    LiquidatorProxyV6__factory.connect,
    governance,
  );

  const oracleAggregatorV2 = getContract(
    ModuleDeployments.OracleAggregatorV2[config.network].address,
    OracleAggregatorV2__factory.connect,
    governance,
  );

  const ownerAdapterV1 = getContract(
    ModuleDeployments.DolomiteOwnerV1[config.network].address,
    DolomiteOwnerV1__factory.connect,
    gnosisSafe,
  );
  const ownerAdapterV2 = getContract(
    ModuleDeployments.DolomiteOwnerV2[config.network].address,
    DolomiteOwnerV2__factory.connect,
    gnosisSafe,
  );

  const testEcosystem = await createTestEcosystem(dolomiteMargin, governance);

  const deployedVaults = await getDeployedVaults(config, dolomiteMargin, governance);
  const marketIdToDeployedVaultMap = deployedVaults.reduce((acc, vault) => {
    acc[vault.marketId] = vault;
    return acc;
  }, {} as Record<number, DeployedVault>);

  const libraries: LibraryMaps = {
    safeDelegateCallImpl: createSafeDelegateCallLibraries(config),
    tokenVaultActionsImpl: createTokenVaultActionsLibraries(config),
    unwrapperTraderImpl: createAsyncUnwrapperImplLibraries(config),
    wrapperTraderImpl: createAsyncWrapperImplLibraries(config),
    genericTraderProxyV2Lib: createGenericTraderProxyV2LibLibraries(config),
  };

  const coreProtocolParams: CoreProtocolParams<T> = {
    adminClaimExcessTokens,
    adminPauseMarket,
    borrowPositionProxyV2,
    borrowPositionRouter,
    chainlinkPriceOracleV1,
    chainlinkPriceOracleV3,
    daoAddress,
    delayedMultiSig,
    deployedVaults,
    depositWithdrawalProxy,
    depositWithdrawalRouter,
    dolomiteMargin,
    dolomiteRegistry,
    dolomiteRegistryProxy,
    dolomiteAccountRegistry,
    dolomiteAccountRegistryProxy,
    dolomiteAccountRiskOverrideSetter,
    dolomiteAccountRiskOverrideSetterProxy,
    eventEmitterRegistry,
    eventEmitterRegistryProxy,
    expiry,
    freezableLiquidatorProxy,
    genericTraderProxy,
    genericTraderRouter,
    gnosisSafe,
    gnosisSafeAddress,
    governance,
    governanceAddress,
    implementationContracts,
    interestSetters,
    libraries,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV4,
    liquidatorProxyV6,
    marketIdToDeployedVaultMap,
    oracleAggregatorV2,
    ownerAdapterV1,
    ownerAdapterV2,
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
    dTokens: {
      all: await gatherAllDolomite4626TokenContracts(config, hhUser1),
    },
    marketIds: {
      usdc: USDC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
      stablecoins: [USDC_MAP[config.network].marketId],
      stablecoinsWithUnifiedInterestRateModels: [USDC_MAP[config.network].marketId],
    },
    tokens: {
      payableToken: IWETH__factory.connect(PAYABLE_TOKEN_MAP[config.network].address, hhUser1),
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
      chaosLabsPriceOracleV3: IChaosLabsPriceOracleV3__factory.connect(
        ModuleDeployments.ChaosLabsPriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      chroniclePriceOracleV3: ChroniclePriceOracleV3__factory.connect(
        ModuleDeployments.ChroniclePriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      dolomiteAccountValuesReader: IDolomiteAccountValuesReader__factory.connect(
        CoreDeployments.AccountValuesReader[typedConfig.network].address,
        hhUser1,
      ),
      dolomiteMigrator: IDolomiteMigrator__factory.connect(
        ModuleDeployments.DolomiteMigratorV2[typedConfig.network].address,
        hhUser1,
      ),
      dTokens: {
        ...coreProtocolParams.dTokens,
        bridgedUsdc: DolomiteERC4626__factory.connect(
          ModuleDeployments.DolomiteBridgedUsdc4626Token[typedConfig.network].address,
          hhUser1,
        ),
        dai: getDolomite4626TokenContract(config, hhUser1, 'DolomiteDai4626Token'),
        usdc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsdc4626Token'),
        usdt: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsdt4626Token'),
        wbtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteWbtc4626Token'),
        weth: getDolomiteWeth4626TokenContract(typedConfig, hhUser1)!,
      },
      dTokensOld: {
        usdc: DolomiteERC20__factory.connect(ModuleDeployments.DolomiteUsdcToken[typedConfig.network].address, hhUser1),
        wbtc: DolomiteERC20__factory.connect(ModuleDeployments.DolomiteWbtcToken[typedConfig.network].address, hhUser1),
        weth: DolomiteERC20WithPayable__factory.connect(
          ModuleDeployments.DolomiteWethToken[typedConfig.network].address,
          hhUser1,
        ),
        usdcProxy: RegistryProxy__factory.connect(
          ModuleDeployments.DolomiteUsdcToken[typedConfig.network].address,
          hhUser1,
        ),
        wbtcProxy: RegistryProxy__factory.connect(
          ModuleDeployments.DolomiteWbtcToken[typedConfig.network].address,
          hhUser1,
        ),
        wethProxy: RegistryProxy__factory.connect(
          ModuleDeployments.DolomiteWethToken[typedConfig.network].address,
          hhUser1,
        ),
      },
      glvEcosystem: await createGlvEcosystem(typedConfig.network, hhUser1),
      gmxEcosystem: await createGmxEcosystem(typedConfig.network, hhUser1),
      gmxEcosystemV2: await createGmxEcosystemV2(typedConfig.network, hhUser1),
      jonesEcosystem: await createJonesEcosystem(typedConfig.network, hhUser1),
      liquidityMiningEcosystem: {
        goARB: await createGoARBLiquidityMiningEcosystem(typedConfig.network, hhUser1),
        minerals: await createMineralLiquidityMiningEcosystem(typedConfig.network, hhUser1),
        oARB: await createOARBLiquidityMiningEcosystem(typedConfig.network, hhUser1),
      },
      odosEcosystem: await createOdosEcosystem(typedConfig.network, hhUser1),
      paraswapEcosystem: await createParaswapEcosystem(typedConfig.network, hhUser1),
      pendleEcosystem: await createPendleEcosystemArbitrumOne(typedConfig.network, hhUser1),
      plutusEcosystem: await createPlutusEcosystem(typedConfig.network, hhUser1),
      premiaEcosystem: await createPremiaEcosystem(typedConfig.network, hhUser1),
      redstonePriceOracleV3: RedstonePriceOracleV3__factory.connect(
        ModuleDeployments.RedstonePriceOracleV3[typedConfig.network].address,
        hhUser1,
      ),
      umamiEcosystem: await createUmamiEcosystem(typedConfig.network, hhUser1),
      marketIds: {
        ...coreProtocolParams.marketIds,
        aave: AAVE_MAP[typedConfig.network].marketId,
        arb: ARB_MAP[typedConfig.network].marketId,
        dArb: D_ARB_MAP[typedConfig.network].marketId,
        dfsGlp: DFS_GLP_MAP[typedConfig.network].marketId,
        dGlvBtc: D_GLV_BTC_MAP[typedConfig.network].marketId,
        dGlvEth: D_GLV_ETH_MAP[typedConfig.network].marketId,
        dGmx: D_GMX_MAP[typedConfig.network].marketId,
        dGmAaveUsd: D_GM_AAVE_USD_MAP[typedConfig.network].marketId,
        dGmArbUsd: D_GM_ARB_USD_MAP[typedConfig.network].marketId,
        dGmBtcUsd: D_GM_BTC_USD_MAP[typedConfig.network].marketId,
        dGmBtc: D_GM_BTC_MAP[typedConfig.network].marketId,
        dGmDogeUsd: D_GM_DOGE_USD_MAP[typedConfig.network].marketId,
        dGmEthUsd: D_GM_ETH_USD_MAP[typedConfig.network].marketId,
        dGmEth: D_GM_ETH_MAP[typedConfig.network].marketId,
        dGmGmxUsd: D_GM_GMX_USD_MAP[typedConfig.network].marketId,
        dGmLinkUsd: D_GM_LINK_USD_MAP[typedConfig.network].marketId,
        dGmPendleUsd: D_GM_PENDLE_USD_MAP[typedConfig.network].marketId,
        dGmPepeUsd: D_GM_PEPE_USD_MAP[typedConfig.network].marketId,
        dGmSolUsd: D_GM_SOL_USD_MAP[typedConfig.network].marketId,
        dGmUniUsd: D_GM_UNI_USD_MAP[typedConfig.network].marketId,
        dGmWstEthUsd: D_GM_WST_ETH_USD_MAP[typedConfig.network].marketId,
        djUsdcV1: DJ_USDC_V1[typedConfig.network].marketId,
        djUsdcV2: DJ_USDC_V2[typedConfig.network].marketId,
        dplvGlp: DPLV_GLP_MAP[typedConfig.network].marketId,
        dPtEzEthJun2024: DPT_EZ_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtEzEthSep2024: DPT_EZ_ETH_SEP_2024_MAP[typedConfig.network].marketId,
        dPtGlpMar2024: DPT_GLP_MAR_2024_MAP[typedConfig.network].marketId,
        dPtREthJun2025: DPT_R_ETH_JUN_2025_MAP[typedConfig.network].marketId,
        dPtRsEthSep2024: DPT_RS_ETH_SEP_2024_MAP[typedConfig.network].marketId,
        dPtWeEthApr2024: DPT_WE_ETH_APR_2024_MAP[typedConfig.network].marketId,
        dPtWeEthJun2024: DPT_WE_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtWeEthSep2024: DPT_WE_ETH_SEP_2024_MAP[typedConfig.network].marketId,
        dPtWstEthJun2024: DPT_WST_ETH_JUN_2024_MAP[typedConfig.network].marketId,
        dPtWstEthJun2025: DPT_WST_ETH_JUN_2025_MAP[typedConfig.network].marketId,
        dai: DAI_MAP[typedConfig.network]!.marketId,
        dpx: DPX_MAP[typedConfig.network].marketId,
        dYtGlp: DYT_GLP_2024_MAP[typedConfig.network].marketId,
        eUsd: E_USD_MAP[typedConfig.network].marketId,
        ethPlus: ETH_PLUS_MAP[typedConfig.network].marketId,
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
        pendle: PENDLE_MAP[typedConfig.network].marketId,
        premia: PREMIA_MAP[typedConfig.network].marketId,
        pumpBtc: PUMP_BTC_MAP[typedConfig.network].marketId,
        rEth: R_ETH_MAP[typedConfig.network].marketId,
        rsEth: RS_ETH_MAP[typedConfig.network].marketId,
        radiant: RDNT_MAP[typedConfig.network].marketId,
        sGlp: S_GLP_MAP[typedConfig.network].marketId,
        sUsds: S_USDS_MAP[typedConfig.network].marketId,
        tbtc: TBTC_MAP[typedConfig.network].marketId,
        uni: UNI_MAP[typedConfig.network].marketId,
        uniBtc: UNI_BTC_MAP[typedConfig.network].marketId,
        usds: USDS_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        weEth: WE_ETH_MAP[typedConfig.network].marketId,
        woEth: WO_ETH_MAP[typedConfig.network].marketId,
        wstEth: WST_ETH_MAP[typedConfig.network].marketId,
        wusdl: W_USDL_MAP[typedConfig.network].marketId,
        wusdm: W_USDM_MAP[typedConfig.network].marketId,
        xai: XAI_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          DAI_MAP[typedConfig.network]!.marketId,
          GRAI_MAP[typedConfig.network].marketId,
          MIM_MAP[typedConfig.network].marketId,
          NATIVE_USDC_MAP[typedConfig.network].marketId,
          S_USDS_MAP[typedConfig.network].marketId,
          USDE_MAP[typedConfig.network].marketId,
          USDS_MAP[typedConfig.network].marketId,
          USDT_MAP[typedConfig.network].marketId,
          W_USDM_MAP[typedConfig.network].marketId,
        ],
        stablecoinsWithUnifiedInterestRateModels: [
          ...coreProtocolParams.marketIds.stablecoins,
          DAI_MAP[typedConfig.network]!.marketId,
          MIM_MAP[typedConfig.network].marketId,
          NATIVE_USDC_MAP[typedConfig.network].marketId,
          USDE_MAP[typedConfig.network].marketId,
          USDS_MAP[typedConfig.network].marketId,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      tokens: {
        ...coreProtocolParams.tokens,
        aave: IERC20__factory.connect(AAVE_MAP[typedConfig.network].address, hhUser1),
        arb: IERC20__factory.connect(ARB_MAP[typedConfig.network].address, hhUser1),
        dai: IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
        dArb: IERC20__factory.connect(D_ARB_MAP[typedConfig.network].address, hhUser1),
        dfsGlp: IERC20__factory.connect(DFS_GLP_MAP[typedConfig.network].address, hhUser1),
        dGlvBtc: IERC20__factory.connect(D_GLV_BTC_MAP[typedConfig.network].address, hhUser1),
        dGlvEth: IERC20__factory.connect(D_GLV_ETH_MAP[typedConfig.network].address, hhUser1),
        dGmx: IERC20__factory.connect(D_GMX_MAP[typedConfig.network].address, hhUser1),
        dGmArbUsd: IERC20__factory.connect(D_GM_ARB_USD_MAP[typedConfig.network].address, hhUser1),
        dGmBtc: IERC20__factory.connect(D_GM_BTC_MAP[typedConfig.network].address, hhUser1),
        dGmBtcUsd: IERC20__factory.connect(D_GM_BTC_USD_MAP[typedConfig.network].address, hhUser1),
        dGmEth: IERC20__factory.connect(D_GM_ETH_MAP[typedConfig.network].address, hhUser1),
        dGmEthUsd: IERC20__factory.connect(D_GM_ETH_USD_MAP[typedConfig.network].address, hhUser1),
        dGmGmx: IERC20__factory.connect(D_GM_GMX_MAP[typedConfig.network].address, hhUser1),
        dGmGmxUsd: IERC20__factory.connect(D_GM_GMX_USD_MAP[typedConfig.network].address, hhUser1),
        dGmLinkUsd: IERC20__factory.connect(D_GM_LINK_USD_MAP[typedConfig.network].address, hhUser1),
        dGmPendleUsd: IERC20__factory.connect(D_GM_PENDLE_USD_MAP[typedConfig.network].address, hhUser1),
        dGmPepeUsd: IERC20__factory.connect(D_GM_PEPE_USD_MAP[typedConfig.network].address, hhUser1),
        dGmSolUsd: IERC20__factory.connect(D_GM_SOL_USD_MAP[typedConfig.network].address, hhUser1),
        dGmWifUsd: IERC20__factory.connect(D_GM_WIF_USD_MAP[typedConfig.network].address, hhUser1),
        djUsdcV1: IERC20__factory.connect(DJ_USDC_V1[typedConfig.network].address, hhUser1),
        djUsdcV2: IERC20__factory.connect(DJ_USDC_V2[typedConfig.network].address, hhUser1),
        dPtGlp: IERC20__factory.connect(DPT_GLP_MAR_2024_MAP[typedConfig.network].address, hhUser1),
        dPtREthJun2025: IERC20__factory.connect(DPT_R_ETH_JUN_2025_MAP[typedConfig.network].address, hhUser1),
        dPtWeEthApr2024: IERC20__factory.connect(DPT_WE_ETH_APR_2024_MAP[typedConfig.network].address, hhUser1),
        dPtWstEthJun2024: IERC20__factory.connect(DPT_WST_ETH_JUN_2024_MAP[typedConfig.network].address, hhUser1),
        dPtWstEthJun2025: IERC20__factory.connect(DPT_WST_ETH_JUN_2025_MAP[typedConfig.network].address, hhUser1),
        dpx: IERC20__factory.connect(DPX_MAP[typedConfig.network].address, hhUser1),
        dYtGlp: IERC20__factory.connect(DYT_GLP_2024_MAP[typedConfig.network].address, hhUser1),
        ethPlus: IERC20__factory.connect(ETH_PLUS_MAP[typedConfig.network].address, hhUser1),
        eEth: IERC20__factory.connect(E_ETH_MAP[typedConfig.network].address, hhUser1),
        ezEth: IERC20__factory.connect(EZ_ETH_MAP[typedConfig.network].address, hhUser1),
        ezEthReversed: IERC20__factory.connect(EZ_ETH_REVERSED_MAP[typedConfig.network].address, hhUser1),
        eUsd: IERC20__factory.connect(E_USD_MAP[typedConfig.network].address, hhUser1),
        frax: IERC20__factory.connect(FRAX_MAP[typedConfig.network].address, hhUser1),
        gmx: IERC20__factory.connect(GMX_MAP[typedConfig.network].address, hhUser1),
        gmxBtc: IERC20__factory.connect(BTC_PLACEHOLDER_MAP[typedConfig.network].address, hhUser1),
        grai: IERC20__factory.connect(GRAI_MAP[typedConfig.network].address, hhUser1),
        grail: IERC20__factory.connect(GRAIL_MAP[typedConfig.network].address, hhUser1),
        jones: IERC20__factory.connect(JONES_MAP[typedConfig.network].address, hhUser1),
        link: IERC20__factory.connect(LINK_MAP[typedConfig.network]!.address, hhUser1),
        mGlp: IERC20__factory.connect(MAGIC_GLP_MAP[typedConfig.network].address, hhUser1),
        magic: IERC20__factory.connect(MAGIC_MAP[typedConfig.network].address, hhUser1),
        mim: IERC20__factory.connect(MIM_MAP[typedConfig.network].address, hhUser1),
        nativeUsdc: IERC20__factory.connect(NATIVE_USDC_MAP[typedConfig.network].address, hhUser1),
        pendle: IERC20__factory.connect(PENDLE_MAP[typedConfig.network].address, hhUser1),
        premia: IERC20__factory.connect(PREMIA_MAP[typedConfig.network].address, hhUser1),
        pumpBtc: IERC20__factory.connect(PUMP_BTC_MAP[typedConfig.network].address, hhUser1),
        rEth: IERC20__factory.connect(R_ETH_MAP[typedConfig.network].address, hhUser1),
        rsEth: IERC20__factory.connect(RS_ETH_MAP[typedConfig.network].address, hhUser1),
        rsEthReversed: IERC20__factory.connect(RS_ETH_REVERSED_MAP[typedConfig.network].address, hhUser1),
        radiant: IERC20__factory.connect(RDNT_MAP[typedConfig.network].address, hhUser1),
        sGlp: IERC20__factory.connect(S_GLP_MAP[typedConfig.network].address, hhUser1),
        sUsds: IERC20__factory.connect(S_USDS_MAP[typedConfig.network].address, hhUser1),
        size: IERC20__factory.connect(SIZE_MAP[typedConfig.network].address, hhUser1),
        sol: IERC20__factory.connect(SOL_MAP[typedConfig.network].address, hhUser1),
        stEth: IERC20__factory.connect(ST_ETH_MAP[typedConfig.network].address, hhUser1),
        tbtc: IERC20__factory.connect(TBTC_MAP[typedConfig.network].address, hhUser1),
        uni: IERC20__factory.connect(UNI_MAP[typedConfig.network].address, hhUser1),
        uniBtc: IERC20__factory.connect(UNI_BTC_MAP[typedConfig.network].address, hhUser1),
        usde: IERC20__factory.connect(USDE_MAP[typedConfig.network].address, hhUser1),
        usdl: IERC20__factory.connect(USDL_MAP[typedConfig.network].address, hhUser1),
        usdm: IERC20__factory.connect(USDM_MAP[typedConfig.network].address, hhUser1),
        usds: IERC20__factory.connect(USDS_MAP[typedConfig.network].address, hhUser1),
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        weth: coreProtocolParams.tokens.weth as any,
        weEth: IERC20__factory.connect(WE_ETH_MAP[typedConfig.network].address, hhUser1),
        woEth: IERC20__factory.connect(WO_ETH_MAP[typedConfig.network].address, hhUser1),
        wstEth: IERC20__factory.connect(WST_ETH_MAP[typedConfig.network].address, hhUser1),
        wusdl: IERC20__factory.connect(W_USDL_MAP[typedConfig.network].address, hhUser1),
        wusdm: IERC20__factory.connect(W_USDM_MAP[typedConfig.network].address, hhUser1),
        xai: IERC20__factory.connect(XAI_MAP[typedConfig.network].address, hhUser1),
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(DAI_MAP[typedConfig.network]!.address, hhUser1),
          IERC20__factory.connect(GRAI_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(MIM_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(NATIVE_USDC_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(USDE_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
          IERC20__factory.connect(W_USDM_MAP[typedConfig.network].address, hhUser1),
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
  if (config.network === Network.Berachain) {
    const typedConfig = config as CoreProtocolSetupConfig<Network.Berachain>;
    const berachainRewardsEcosystem = await createBerachainRewardsEcosystem(typedConfig.network, hhUser1);
    const chroniclePriceOracle = ChroniclePriceOracleV3__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('ChroniclePriceOracle', Network.Berachain, ADDRESS_ZERO),
      hhUser1,
    );
    const chainsightPriceOracle = ChainsightPriceOracleV3__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('ChainsightPriceOracle', Network.Berachain, ADDRESS_ZERO),
      hhUser1,
    );
    const oogaBoogaEcosystem = await createOogaBoogaEcosystem(config.network, hhUser1);
    const redstonePriceOracle = RedstonePriceOracleV3__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('RedstonePriceOracle', Network.Berachain, ADDRESS_ZERO),
      hhUser1,
    );
    const tokenomics = await createTokenomicsEcosystem(typedConfig.network, hhUser1);
    const tokenomicsAirdrop = await createTokenomicsAirdropEcosystem(typedConfig.network, hhUser1);
    return new CoreProtocolBerachain(coreProtocolParams as CoreProtocolParams<Network.Berachain>, {
      berachainRewardsEcosystem,
      oogaBoogaEcosystem,
      tokenomics,
      tokenomicsAirdrop,
      chroniclePriceOracleV3: chroniclePriceOracle,
      chainsightPriceOracleV3: chainsightPriceOracle,
      redstonePriceOracleV3: redstonePriceOracle,
      dTokens: {
        ...coreProtocolParams.dTokens,
        beraEth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteBeraEth4626Token'),
        // dolo: getDolomite4626TokenContract(config, hhUser1, 'DolomiteDolo4626Token'),
        deUsd: getDolomite4626TokenContract(config, hhUser1, 'DolomiteDeUsd4626Token'),
        eBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteEBtc4626Token'),
        honey: getDolomite4626TokenContract(config, hhUser1, 'DolomiteHoney4626Token'),
        lbtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteLbtc4626Token'),
        nect: getDolomite4626TokenContract(config, hhUser1, 'DolomiteNect4626Token'),
        pumpBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomitePumpBtc4626Token'),
        rsEth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteRsEth4626Token'),
        rswEth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteRswEth4626Token'),
        rUsd: getDolomite4626TokenContract(config, hhUser1, 'DolomiteRUsd4626Token'),
        sbtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSbtc4626Token'),
        sUsda: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSUsda4626Token'),
        sUsde: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSUsde4626Token'),
        srUsd: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSrUsd4626Token'),
        sdeUsd: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSdeUsd4626Token'),
        stBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteStBtc4626Token'),
        solvBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSolvBtc4626Token'),
        solvBtcBbn: getDolomite4626TokenContract(config, hhUser1, 'DolomiteSolvBtcBbn4626Token'),
        stone: getDolomite4626TokenContract(config, hhUser1, 'DolomiteStone4626Token'),
        uniBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUniBtc4626Token'),
        usd0: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsd04626Token'),
        usd0pp: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsd0pp4626Token'),
        usda: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsda4626Token'),
        usdc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsdc4626Token'),
        usde: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsde4626Token'),
        usdt: getDolomite4626TokenContract(config, hhUser1, 'DolomiteUsdt4626Token'),
        wbera: getDolomite4626WithPayableTokenContract(config, hhUser1, 'DolomiteWBera4626Token'),
        wbtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteWbtc4626Token'),
        weth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteWeth4626Token'),
        weEth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteWeEth4626Token'),
        ylBtcLst: getDolomite4626TokenContract(config, hhUser1, 'DolomiteYlBtcLst4626Token'),
        ylPumpBtc: getDolomite4626TokenContract(config, hhUser1, 'DolomiteYlPumpBtc4626Token'),
        ylStEth: getDolomite4626TokenContract(config, hhUser1, 'DolomiteYlStEth4626Token'),
      },
      marketIds: {
        ...coreProtocolParams.marketIds,
        beraEth: BERA_ETH_MAP[typedConfig.network].marketId,
        deUsd: DE_USD_MAP[typedConfig.network].marketId,
        diBgt: D_IBGT_MAP[typedConfig.network].marketId,
        dolo: DOLO_MAP[typedConfig.network].marketId,
        eBtc: E_BTC_MAP[typedConfig.network].marketId,
        henlo: HENLO_MAP[typedConfig.network].marketId,
        honey: HONEY_MAP[typedConfig.network].marketId,
        iBera: IBERA_MAP[typedConfig.network].marketId,
        iBgt: IBGT_MAP[typedConfig.network].marketId,
        lbtc: LBTC_MAP[typedConfig.network].marketId,
        nect: NECT_MAP[typedConfig.network].marketId,
        ohm: OHM_MAP[typedConfig.network].marketId,
        pumpBtc: PUMP_BTC_MAP[typedConfig.network].marketId,
        rsEth: RS_ETH_MAP[typedConfig.network].marketId,
        rswEth: RSW_ETH_MAP[typedConfig.network].marketId,
        rUsd: R_USD_MAP[typedConfig.network].marketId,
        sbtc: STONE_BTC_MAP[typedConfig.network].marketId,
        sUsda: S_USDA_MAP[typedConfig.network].marketId,
        sUsde: S_USDE_MAP[typedConfig.network].marketId,
        sdeUsd: SDE_USD_MAP[typedConfig.network].marketId,
        stBtc: ST_BTC_MAP[typedConfig.network].marketId,
        srUsd: SR_USD_MAP[typedConfig.network].marketId,
        solvBtc: SOLV_BTC_MAP[typedConfig.network].marketId,
        stone: STONE_MAP[typedConfig.network].marketId,
        uniBtc: UNI_BTC_MAP[typedConfig.network].marketId,
        usd0: USD0_MAP[typedConfig.network].marketId,
        usd0pp: USD0PP_MAP[typedConfig.network].marketId,
        usda: USDA_MAP[typedConfig.network].marketId,
        usde: USDE_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbera: WBERA_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        weEth: WE_ETH_MAP[typedConfig.network].marketId,
        xSolvBtc: X_SOLV_BTC_MAP[typedConfig.network].marketId,
        ylFbtc: YL_FBTC_MAP[typedConfig.network].marketId,
        ylPumpBtc: YL_PUMP_BTC_MAP[typedConfig.network].marketId,
        ylStEth: YL_ST_ETH_MAP[typedConfig.network].marketId,
        stablecoins: [...coreProtocolParams.marketIds.stablecoins, HONEY_MAP[typedConfig.network].marketId],
        stablecoinsWithUnifiedInterestRateModels: [
          ...coreProtocolParams.marketIds.stablecoins,
          HONEY_MAP[typedConfig.network].marketId,
          USDA_MAP[typedConfig.network].marketId,
          USDE_MAP[typedConfig.network].marketId,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      tokens: {
        ...coreProtocolParams.tokens,
        bgt: IBGT__factory.connect(BGT_MAP[typedConfig.network].address, hhUser1),
        btcPlaceholder: IERC20__factory.connect(BTC_PLACEHOLDER_MAP[typedConfig.network].address, hhUser1),
        beraEth: IERC20__factory.connect(BERA_ETH_MAP[typedConfig.network].address, hhUser1),
        deUsd: IERC20__factory.connect(DE_USD_MAP[typedConfig.network].address, hhUser1),
        diBgt: IERC20__factory.connect(D_IBGT_MAP[typedConfig.network].address, hhUser1),
        dolo: IERC20__factory.connect(DOLO_MAP[typedConfig.network].address, hhUser1),
        eBtc: IERC20__factory.connect(E_BTC_MAP[typedConfig.network].address, hhUser1),
        fbtc: IERC20__factory.connect(FBTC_MAP[typedConfig.network].address, hhUser1),
        henlo: IERC20__factory.connect(HENLO_MAP[typedConfig.network].address, hhUser1),
        honey: IERC20__factory.connect(HONEY_MAP[typedConfig.network].address, hhUser1),
        iBera: IERC20__factory.connect(IBERA_MAP[typedConfig.network].address, hhUser1),
        iBgt: IERC20__factory.connect(IBGT_MAP[typedConfig.network].address, hhUser1),
        lbtc: IERC20__factory.connect(LBTC_MAP[typedConfig.network].address, hhUser1),
        nect: IERC20__factory.connect(NECT_MAP[typedConfig.network].address, hhUser1),
        ohm: IERC20__factory.connect(OHM_MAP[typedConfig.network].address, hhUser1),
        pumpBtc: IERC20__factory.connect(PUMP_BTC_MAP[typedConfig.network].address, hhUser1),
        rsEth: IERC20__factory.connect(RS_ETH_MAP[typedConfig.network].address, hhUser1),
        rswEth: IERC20__factory.connect(RSW_ETH_MAP[typedConfig.network].address, hhUser1),
        rUsd: IERC20__factory.connect(R_USD_MAP[typedConfig.network].address, hhUser1),
        stonebtc: IERC20__factory.connect(STONE_BTC_MAP[typedConfig.network].address, hhUser1),
        sUsda: IERC20__factory.connect(S_USDA_MAP[typedConfig.network].address, hhUser1),
        sUsde: IERC20__factory.connect(S_USDE_MAP[typedConfig.network].address, hhUser1),
        sdeUsd: IERC20__factory.connect(SDE_USD_MAP[typedConfig.network].address, hhUser1),
        srUsd: IERC20__factory.connect(SR_USD_MAP[typedConfig.network].address, hhUser1),
        stBtc: IERC20__factory.connect(ST_BTC_MAP[typedConfig.network].address, hhUser1),
        solvBtc: IERC20__factory.connect(SOLV_BTC_MAP[typedConfig.network].address, hhUser1),
        stone: IERC20__factory.connect(STONE_MAP[typedConfig.network].address, hhUser1),
        uniBtc: IERC20__factory.connect(UNI_BTC_MAP[typedConfig.network].address, hhUser1),
        usd0: IERC20__factory.connect(USD0_MAP[typedConfig.network].address, hhUser1),
        usd0pp: IERC20__factory.connect(USD0PP_MAP[typedConfig.network].address, hhUser1),
        usda: IERC20__factory.connect(USDA_MAP[typedConfig.network].address, hhUser1),
        usde: IERC20__factory.connect(USDE_MAP[typedConfig.network].address, hhUser1),
        usdt: IERC20__factory.connect(USDT_MAP[typedConfig.network].address, hhUser1),
        wbera: IWETH__factory.connect(WBERA_MAP[typedConfig.network].address, hhUser1),
        wbtc: IERC20__factory.connect(WBTC_MAP[typedConfig.network].address, hhUser1),
        weEth: IERC20__factory.connect(WE_ETH_MAP[typedConfig.network].address, hhUser1),
        xSolvBtc: IERC20__factory.connect(X_SOLV_BTC_MAP[typedConfig.network].address, hhUser1),
        ylBtcLst: IERC20__factory.connect(YL_FBTC_MAP[typedConfig.network].address, hhUser1),
        ylPumpBtc: IERC20__factory.connect(YL_PUMP_BTC_MAP[typedConfig.network].address, hhUser1),
        ylStEth: IERC20__factory.connect(YL_ST_ETH_MAP[typedConfig.network].address, hhUser1),
        stablecoins: [
          ...coreProtocolParams.tokens.stablecoins,
          IERC20__factory.connect(HONEY_MAP[typedConfig.network].address, hhUser1),
        ],
      },
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
      mantleRewardStation: IMantleRewardStation__factory.connect(
        MANTLE_REWARD_STATION_MAP[typedConfig.network],
        hhUser1,
      ),
      marketIds: {
        ...coreProtocolParams.marketIds,
        cmEth: CM_ETH_MAP[typedConfig.network].marketId,
        fbtc: FBTC_MAP[typedConfig.network].marketId,
        meth: METH_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        usdy: USDY_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        wmnt: WMNT_MAP[typedConfig.network].marketId,
        usde: USDE_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          USDT_MAP[typedConfig.network].marketId,
          USDY_MAP[typedConfig.network].marketId,
        ],
        stablecoinsWithUnifiedInterestRateModels: [
          ...coreProtocolParams.marketIds.stablecoins,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      odosEcosystem: await createOdosEcosystem(typedConfig.network, hhUser1),
      pendleEcosystem: await createPendleEcosystemMantle(typedConfig.network, hhUser1),
      redstonePriceOracleV3: redstonePriceOracle,
      tokens: {
        ...coreProtocolParams.tokens,
        cmEth: IERC20__factory.connect(CM_ETH_MAP[typedConfig.network].address, hhUser1),
        fbtc: IERC20__factory.connect(FBTC_MAP[typedConfig.network].address, hhUser1),
        meth: IERC20__factory.connect(METH_MAP[typedConfig.network].address, hhUser1),
        usde: IERC20__factory.connect(USDE_MAP[typedConfig.network].address, hhUser1),
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
        pol: POL_MAP[typedConfig.network].marketId,
        usdt: USDT_MAP[typedConfig.network].marketId,
        wbtc: WBTC_MAP[typedConfig.network].marketId,
        stablecoins: [
          ...coreProtocolParams.marketIds.stablecoins,
          DAI_MAP[typedConfig.network]!.marketId,
          USDT_MAP[typedConfig.network].marketId,
        ],
        stablecoinsWithUnifiedInterestRateModels: [
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
        pol: IERC20__factory.connect(POL_MAP[typedConfig.network].address, hhUser1),
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
        stablecoinsWithUnifiedInterestRateModels: [
          ...coreProtocolParams.marketIds.stablecoins,
          USDT_MAP[typedConfig.network].marketId,
        ],
      },
      liquidityMiningEcosystem: {
        minerals: await createMineralLiquidityMiningEcosystem(typedConfig.network, hhUser1),
      },
      okxEcosystem: await createOkxEcosystem(typedConfig.network, hhUser1),
      okxPriceOracleV3: OkxPriceOracleV3__factory.connect(
        ModuleDeployments.OkxPriceOracleV3[typedConfig.network].address,
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

export async function setupTestMarket<T extends DolomiteNetwork>(
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

function createImplementationContracts(network: Network, signer: SignerWithAddressWithSafety): ImplementationContracts {
  return {
    dolomiteERC4626Implementation: DolomiteERC4626__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('DolomiteERC4626Implementation', network),
      signer,
    ),
    dolomiteERC4626WithPayableImplementation: DolomiteERC4626WithPayable__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('DolomiteERC4626WithPayableImplementation', network),
      signer,
    ),
  };
}

function createSafeDelegateCallLibraries<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    SafeDelegateCallLib: getMaxDeploymentVersionAddressByDeploymentKey('SafeDelegateCallLib', config.network),
  };
}

function createTokenVaultActionsLibraries<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    IsolationModeTokenVaultV1ActionsImpl: getMaxDeploymentVersionAddressByDeploymentKey(
      'IsolationModeTokenVaultV1ActionsImpl',
      config.network,
    ),
  };
}

function createGenericTraderProxyV2LibLibraries<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    GenericTraderProxyV2Lib: getMaxDeploymentVersionAddressByDeploymentKey(
      'GenericTraderProxyV2Lib',
      config.network,
    ),
  };
}

function createAsyncUnwrapperImplLibraries<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
): Record<string, string> {
  return {
    AsyncIsolationModeUnwrapperTraderImpl: getMaxDeploymentVersionAddressByDeploymentKey(
      'AsyncIsolationModeUnwrapperTraderImpl',
      config.network,
    ),
  };
}

function createAsyncWrapperImplLibraries<T extends DolomiteNetwork>(
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
  const deploymentsMap = readDeploymentFile();
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
