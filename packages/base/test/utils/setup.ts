import { IChainlinkAutomationRegistry__factory } from '@dolomite-exchange/modules-jones/src/types';
import { IChainlinkPriceOracle__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumber as ZapBigNumber } from '@dolomite-exchange/zap-sdk/dist';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as IGenericTraderProxyV1Json from '@dolomite-margin/deployed-contracts/GenericTraderProxyV1.json';
import * as LiquidatorAssetRegistryJson from '@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json';
import * as LiquidatorProxyV1Json from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json';
import { address } from '@dolomite-margin/dist/src';
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface, Signer } from 'ethers';
import { ethers, network } from 'hardhat';
import Deployments, * as deployments from '../../../../scripts/deployments.json';
import {
  IBorrowPositionProxyV2__factory,
  IDepositWithdrawalProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IDolomiteMarginV2,
  IDolomiteMarginV2__factory,
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
  IWETH__factory,
  RegistryProxy__factory,
} from '../../src/types';
import {
  ARB_MAP,
  CHAINLINK_AUTOMATION_REGISTRY_MAP,
  CHAINLINK_PRICE_ORACLE_MAP,
  D_ARB_MAP,
  D_GMX_MAP,
  DAI_MAP,
  DFS_GLP_MAP,
  DJ_USDC,
  DPLV_GLP_MAP,
  DPT_GLP_2024_MAP,
  DPT_R_ETH_JUN_2025_MAP,
  DPT_WST_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2025_MAP,
  DPX_MAP,
  DYT_GLP_2024_MAP,
  GMX_MAP,
  GRAIL_MAP,
  JONES_MAP,
  LINK_MAP,
  MAGIC_GLP_MAP,
  MAGIC_MAP,
  MIM_MAP,
  NATIVE_USDC_MAP,
  PENDLE_MAP,
  PREMIA_MAP,
  RDNT_MAP,
  RETH_MAP,
  SIZE_MAP,
  ST_ETH_MAP,
  USDC_MAP,
  USDT_MAP,
  WBTC_MAP,
  WETH_MAP,
  WST_ETH_MAP,
} from '../../src/utils/constants';
import { Network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP } from '../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolArbitrumOne,
  CoreProtocolBase,
  CoreProtocolParams,
  CoreProtocolPolygonZkEvm,
} from './core-protocol';
import { DolomiteMargin, Expiry } from './dolomite';
import { createAbraEcosystem } from './ecosystem-utils/abra';
import { createArbEcosystem } from './ecosystem-utils/arb';
import { createCamelotEcosystem } from './ecosystem-utils/camelot';
import { createGmxEcosystem, createGmxEcosystemV2 } from './ecosystem-utils/gmx';
import { createInterestSetters } from './ecosystem-utils/interest-setters';
import { createJonesEcosystem } from './ecosystem-utils/jones';
import { createLiquidityMiningEcosystem } from './ecosystem-utils/liquidity-mining';
import { createOdosEcosystem } from './ecosystem-utils/odos';
import { createParaswapEcosystem } from './ecosystem-utils/paraswap';
import { createPendleEcosystem } from './ecosystem-utils/pendle';
import { createPlutusEcosystem } from './ecosystem-utils/plutus';
import { createPremiaEcosystem } from './ecosystem-utils/premia';
import { createTestEcosystem } from './ecosystem-utils/testers';
import { createUmamiEcosystem } from './ecosystem-utils/umami';
import { impersonate, impersonateOrFallback, resetFork } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig<T extends Network> {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  blockNumber: number;
  network: T;
}

export interface CoreProtocolConfig<T extends Network> {
  blockNumber: number;
  network: T;
  networkNumber: number;
}

export async function disableInterestAccrual<T extends Network>(core: CoreProtocolAbstract<T>, marketId: BigNumberish) {
  return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.interestSetters.alwaysZeroInterestSetter.address);
}

export async function enableInterestAccrual<T extends Network>(core: CoreProtocolAbstract<T>, marketId: BigNumberish) {
  return core.dolomiteMargin.ownerSetInterestSetter(
    marketId,
    core.interestSetters.linearStepFunction8L92UInterestSetter.address,
  );
}

export async function setupWETHBalance<T extends Network>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  await core.tokens.weth.connect(signer).deposit({ value: amount });
  await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupARBBalance(
  core: CoreProtocolArbitrumOne,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xf3fc178157fb3c87548baa86f9d24ba38e649b58'; // ARB Treasury
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.arb!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.arb!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupDAIBalance<T extends Network>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddress,
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
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x3dd1d15b3c78d6acfd75a254e857cbe5b9ff0af2'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.nativeUsdc!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.nativeUsdc!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance<T extends Network>(
  core: CoreProtocolAbstract<T>,
  signer: SignerWithAddress,
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
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender?: { address: string },
) {
  const controller = await impersonate(core.gmxEcosystemV2!.gmxExchangeRouter.address, true);
  await core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(controller).mint(signer.address, amount);
  if (spender) {
    await core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(signer).approve(spender.address, amount);
  }
}

export async function setupGMXBalance(
  core: { tokens: { gmx: IERC20 } },
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.gmx!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.gmx!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupRETHBalance(
  core: { tokens: { rEth: IERC20 } },
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.rEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.rEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWstETHBalance(
  core: { tokens: { wstEth: IERC20 } },
  signer: SignerWithAddress,
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
  signer?: SignerWithAddress,
): T {
  return new BaseContract(
    vault,
    factoryInterface.abi,
    signer,
  ) as T;
}

export function getDefaultCoreProtocolConfig<T extends Network>(network: T): CoreProtocolConfig<T> {
  return {
    network,
    blockNumber: NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network],
    networkNumber: parseInt(network, 10),
  };
}

export function getDefaultCoreProtocolConfigForGmxV2(): CoreProtocolConfig<Network.ArbitrumOne> {
  return {
    network: Network.ArbitrumOne,
    networkNumber: parseInt(Network.ArbitrumOne, 10),
    blockNumber: 164_788_000,
  };
}

export type CoreProtocolType<T extends Network> = T extends Network.ArbitrumOne
  ? CoreProtocolArbitrumOne
  : T extends Network.Base ? CoreProtocolBase
    : T extends Network.PolygonZkEvm ? CoreProtocolPolygonZkEvm
      : never;

export async function setupCoreProtocol<T extends Network>(
  config: CoreProtocolSetupConfig<T>,
): Promise<CoreProtocolType<T>> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber, config.network);
  } else {
    console.log('\tSkipping forking...');
  }

  const dolomiteMarginAddress = DolomiteMarginJson.networks[config.network].address;
  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const governance: SignerWithAddress = await impersonateOrFallback(
    await IDolomiteMargin__factory.connect(dolomiteMarginAddress, hhUser1).owner(),
    true,
    hhUser1,
  );

  const dolomiteMargin = (config.network === Network.ArbitrumOne
    ? IDolomiteMargin__factory.connect(dolomiteMarginAddress, governance)
    : IDolomiteMarginV2__factory.connect(dolomiteMarginAddress, governance)) as DolomiteMargin<T>;

  const borrowPositionProxyV2 = IBorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
  );

  const chainlinkPriceOracle = getContractOpt(
    CHAINLINK_PRICE_ORACLE_MAP[config.network],
    IChainlinkPriceOracle__factory.connect,
    governance,
  );

  const chainlinkAutomationRegistry = getContractOpt(
    CHAINLINK_AUTOMATION_REGISTRY_MAP[config.network],
    IChainlinkAutomationRegistry__factory.connect,
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
    (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
    governance,
  );
  const dolomiteRegistryProxy = RegistryProxy__factory.connect(
    (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
    governance,
  );
  const eventEmitterRegistry = getContract(
    (Deployments.EventEmitterRegistryProxy as any)[config.network].address,
    IEventEmitterRegistry__factory.connect,
    governance,
  );

  const eventEmitterRegistryProxy = getContract(
    (Deployments.EventEmitterRegistryProxy as any)[config.network].address,
    RegistryProxy__factory.connect,
    governance,
  );

  const expiry = (config.network === Network.ArbitrumOne
    ? IExpiry__factory.connect(ExpiryJson.networks[config.network].address, governance)
    : IExpiryV2__factory.connect(ExpiryJson.networks[config.network].address, governance)) as Expiry<T>;

  const genericTraderProxy = getContract(
    (IGenericTraderProxyV1Json.networks as any)[config.network]!.address,
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
    // LiquidatorProxyV4WithGenericTraderJson.networks[config.network].address,
    '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3',
    ILiquidatorProxyV4WithGenericTrader__factory.connect,
    governance,
  );

  const testEcosystem = await createTestEcosystem(dolomiteMargin, dolomiteRegistry, governance, hhUser1, config);

  const tokenVaultActionsLibraries = await createTokenVaultActionsLibraries(config);

  const coreProtocolParams: CoreProtocolParams<T> = {
    borrowPositionProxyV2,
    delayedMultiSig,
    depositWithdrawalProxy,
    dolomiteMargin,
    dolomiteRegistry,
    dolomiteRegistryProxy,
    eventEmitterRegistry,
    eventEmitterRegistryProxy,
    expiry,
    genericTraderProxy,
    governance,
    interestSetters,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV4,
    testEcosystem,
    tokenVaultActionsLibraries,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    config: {
      blockNumber: config.blockNumber,
      network: config.network,
      networkNumber: parseInt(config.network, 10),
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
      dai: DAI_MAP[config.network].marketId,
      link: LINK_MAP[config.network].marketId,
      usdc: USDC_MAP[config.network].marketId,
      wbtc: WBTC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
    },
    tokens: {
      dai: IERC20__factory.connect(DAI_MAP[config.network].address, hhUser1),
      link: IERC20__factory.connect(LINK_MAP[config.network].address, hhUser1),
      usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
      wbtc: IERC20__factory.connect(WBTC_MAP[config.network].address, hhUser1),
      weth: IWETH__factory.connect(WETH_MAP[config.network].address, hhUser1),
    },
  };

  if (config.network === Network.ArbitrumOne) {
    const abraEcosystem = await createAbraEcosystem(config.network, hhUser1);
    const arbEcosystem = await createArbEcosystem(config.network, hhUser1);
    const camelotEcosystem = await createCamelotEcosystem(config.network, hhUser1);
    const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);
    const gmxEcosystemV2 = await createGmxEcosystemV2(config.network, hhUser1);
    const jonesEcosystem = await createJonesEcosystem(config.network, hhUser1);
    const liquidityMiningEcosystem = await createLiquidityMiningEcosystem(config.network, hhUser1);
    const odosEcosystem = await createOdosEcosystem(config.network, hhUser1);
    const paraswapEcosystem = await createParaswapEcosystem(config.network, hhUser1);
    const pendleEcosystem = await createPendleEcosystem(config.network, hhUser1);
    const plutusEcosystem = await createPlutusEcosystem(config.network, hhUser1);
    const premiaEcosystem = await createPremiaEcosystem(config.network, hhUser1);
    const umamiEcosystem = await createUmamiEcosystem(config.network, hhUser1);

    return new CoreProtocolArbitrumOne(
      coreProtocolParams as CoreProtocolParams<Network.ArbitrumOne>,
      {
        abraEcosystem,
        arbEcosystem,
        camelotEcosystem,
        gmxEcosystem,
        gmxEcosystemV2,
        jonesEcosystem,
        liquidityMiningEcosystem,
        odosEcosystem,
        paraswapEcosystem,
        pendleEcosystem,
        plutusEcosystem,
        premiaEcosystem,
        umamiEcosystem,
        chainlinkAutomationRegistry: chainlinkAutomationRegistry!,
        chainlinkPriceOracle: chainlinkPriceOracle!,
        marketIds: {
          ...coreProtocolParams.marketIds,
          arb: ARB_MAP[config.network]!.marketId,
          dArb: D_ARB_MAP[config.network]!.marketId,
          dfsGlp: DFS_GLP_MAP[config.network]!.marketId,
          dGmx: D_GMX_MAP[config.network]!.marketId,
          djUSDC: DJ_USDC[config.network]!.marketId,
          dplvGlp: DPLV_GLP_MAP[config.network]!.marketId,
          dPtGlp: DPT_GLP_2024_MAP[config.network]!.marketId,
          dPtREthJun2025: DPT_R_ETH_JUN_2025_MAP[config.network]!.marketId,
          dPtWstEthJun2024: DPT_WST_ETH_JUN_2024_MAP[config.network]!.marketId,
          dPtWstEthJun2025: DPT_WST_ETH_JUN_2025_MAP[config.network]!.marketId,
          dpx: DPX_MAP[config.network]!.marketId,
          dYtGlp: DYT_GLP_2024_MAP[config.network]!.marketId,
          grail: GRAIL_MAP[config.network]!.marketId,
          jones: JONES_MAP[config.network]!.marketId,
          magic: MAGIC_MAP[config.network]!.marketId,
          magicGlp: MAGIC_GLP_MAP[config.network]!.marketId,
          mim: MIM_MAP[config.network]!.marketId,
          nativeUsdc: NATIVE_USDC_MAP[config.network]!.marketId,
          premia: PREMIA_MAP[config.network]!.marketId,
          rEth: RETH_MAP[config.network]!.marketId,
          radiant: RDNT_MAP[config.network]!.marketId,
          pendle: PENDLE_MAP[config.network]!.marketId,
          usdt: USDT_MAP[config.network]!.marketId,
          wstEth: WST_ETH_MAP[config.network]!.marketId,
        },
        tokens: {
          ...coreProtocolParams.tokens,
          arb: IERC20__factory.connect(ARB_MAP[config.network]!.address, hhUser1),
          dArb: IERC20__factory.connect(D_ARB_MAP[config.network]!.address, hhUser1),
          dfsGlp: IERC20__factory.connect(DFS_GLP_MAP[config.network]!.address, hhUser1),
          dGmx: IERC20__factory.connect(D_GMX_MAP[config.network]!.address, hhUser1),
          dPtGlp: IERC20__factory.connect(DPT_GLP_2024_MAP[config.network]!.address, hhUser1),
          dPtREthJun2025: IERC20__factory.connect(DPT_R_ETH_JUN_2025_MAP[config.network]!.address, hhUser1),
          dPtWstEthJun2024: IERC20__factory.connect(DPT_WST_ETH_JUN_2024_MAP[config.network]!.address, hhUser1),
          dPtWstEthJun2025: IERC20__factory.connect(DPT_WST_ETH_JUN_2025_MAP[config.network]!.address, hhUser1),
          dpx: IERC20__factory.connect(DPX_MAP[config.network]!.address, hhUser1),
          dYtGlp: IERC20__factory.connect(DYT_GLP_2024_MAP[config.network]!.address, hhUser1),
          gmx: IERC20__factory.connect(GMX_MAP[config.network]!.address, hhUser1),
          grail: IERC20__factory.connect(GRAIL_MAP[config.network]!.address, hhUser1),
          jones: IERC20__factory.connect(JONES_MAP[config.network]!.address, hhUser1),
          magic: IERC20__factory.connect(MAGIC_MAP[config.network]!.address, hhUser1),
          nativeUsdc: IERC20__factory.connect(NATIVE_USDC_MAP[config.network]!.address, hhUser1),
          premia: IERC20__factory.connect(PREMIA_MAP[config.network]!.address, hhUser1),
          pendle: IERC20__factory.connect(PENDLE_MAP[config.network]!.address, hhUser1),
          rEth: IERC20__factory.connect(RETH_MAP[config.network]!.address, hhUser1),
          radiant: IERC20__factory.connect(RDNT_MAP[config.network]!.address, hhUser1),
          size: IERC20__factory.connect(SIZE_MAP[config.network]!.address, hhUser1),
          stEth: IERC20__factory.connect(ST_ETH_MAP[config.network]!.address, hhUser1),
          wstEth: IERC20__factory.connect(WST_ETH_MAP[config.network]!.address, hhUser1),
        },
      },
    ) as any;
  }
  if (config.network === Network.Base) {
    return new CoreProtocolBase(
      coreProtocolParams as CoreProtocolParams<Network.Base>,
    ) as any;
  }
  if (config.network === Network.PolygonZkEvm) {
    return new CoreProtocolPolygonZkEvm(
      coreProtocolParams as CoreProtocolParams<Network.PolygonZkEvm>,
    ) as any;
  }

  return Promise.reject(new Error(`Invalid network, found: ${config.network}`));
}

export async function setupTestMarket<T extends Network>(
  core: CoreProtocolType<T>,
  token: { address: address },
  isClosing: boolean,
  priceOracle?: { address: address },
  marginPremium?: BigNumberish,
  spreadPremium?: BigNumberish,
  earningsRateOverride?: BigNumberish,
) {
  if (core.config.network === Network.ArbitrumOne) {
    await (core.dolomiteMargin as IDolomiteMargin).connect(core.governance).ownerAddMarket(
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
    await (core.dolomiteMargin as IDolomiteMarginV2).connect(core.governance).ownerAddMarket(
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

async function createTokenVaultActionsLibraries<T extends Network>(
  config: CoreProtocolSetupConfig<T>,
): Promise<Record<string, string>> {
  const tokenVaultPrefix = 'IsolationModeTokenVaultV1ActionsImpl';
  const maxTokenVaultVersion = Object.keys(deployments)
    .filter(k => k.startsWith(tokenVaultPrefix) && (deployments as any)[config.network])
    .sort((a, b) => a < b ? 1 : -1)[0];
  if (!maxTokenVaultVersion) {
    return Promise.reject(new Error(`Could not find token vault for network ${config.network}`));
  }

  return {
    IsolationModeTokenVaultV1ActionsImpl: (deployments as any)[maxTokenVaultVersion][config.network].address,
  };
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
