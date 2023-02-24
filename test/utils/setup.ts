import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface } from 'ethers';
import { ethers, network } from 'hardhat';
import {
  BorrowPositionProxyV2,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IDepositWithdrawalProxy,
  IDolomiteAmmRouterProxy,
  IDolomiteMargin,
  IExpiry,
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  DEPOSIT_WITHDRAWAL_PROXY,
  DOLOMITE_AMM_ROUTER,
  DOLOMITE_MARGIN,
  ES_GMX,
  ES_GMX_DISTRIBUTOR,
  EXPIRY,
  FS_GLP,
  GLP,
  GLP_MANAGER,
  GLP_REWARDS_ROUTER,
  GMX,
  GMX_REWARDS_ROUTER,
  GMX_VAULT,
  LIQUIDATOR_PROXY_V2,
  LIQUIDATOR_PROXY_V3,
  S_GLP,
  S_GMX,
  SBF_GMX,
  USDC,
  USDC_MARKET_ID,
  V_GLP,
  V_GMX,
  WETH,
  WETH_MARKET_ID,
} from '../../src/utils/constants';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { impersonate, resetFork } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  blockNumber: number;
}

export interface CoreProtocolConfig {
  blockNumber: number;
}

export interface CoreProtocol {
  config: CoreProtocolConfig;
  governance: SignerWithAddress;
  borrowPositionProxyV2: BorrowPositionProxyV2;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  expiry: IExpiry;
  gmxEcosystem: {
    esGmx: typeof ES_GMX;
    esGmxDistributor: typeof ES_GMX_DISTRIBUTOR;
    fsGlp: typeof FS_GLP;
    glp: typeof GLP;
    glpManager: typeof GLP_MANAGER;
    glpRewardsRouter: typeof GLP_REWARDS_ROUTER;
    gmxRewardsRouter: typeof GMX_REWARDS_ROUTER;
    gmx: typeof GMX;
    gmxVault: typeof GMX_VAULT;
    sGlp: typeof S_GLP;
    sGmx: typeof S_GMX;
    sbfGmx: typeof SBF_GMX;
    vGlp: typeof V_GLP;
    vGmx: typeof V_GMX;
  };
  liquidatorProxyV2: typeof LIQUIDATOR_PROXY_V2;
  liquidatorProxyV3: typeof LIQUIDATOR_PROXY_V3;
  marketIds: {
    usdc: BigNumberish;
    weth: BigNumberish;
  };
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
  usdc: typeof USDC;
  weth: typeof WETH;
  hhUser1: SignerWithAddress;
  hhUser2: SignerWithAddress;
  hhUser3: SignerWithAddress;
  hhUser4: SignerWithAddress;
  hhUser5: SignerWithAddress;
}

export async function setupWETHBalance(signer: SignerWithAddress, amount: BigNumberish, spender: { address: string }) {
  await WETH.connect(signer).deposit({ value: amount });
  await WETH.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance(signer: SignerWithAddress, amount: BigNumberish, spender: { address: string }) {
  const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await USDC.connect(whaleSigner).transfer(signer.address, amount);
  await USDC.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupGMXBalance(signer: SignerWithAddress, amount: BigNumberish, spender: { address: string }) {
  const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await GMX.connect(whaleSigner).transfer(signer.address, amount);
  await GMX.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
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

export function setupGmxRegistry(core: CoreProtocol): Promise<GmxRegistryV1> {
  return createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    [
      {
        esGmx: core.gmxEcosystem.esGmx.address,
        fsGlp: core.gmxEcosystem.fsGlp.address,
        glp: core.gmxEcosystem.glp.address,
        glpManager: core.gmxEcosystem.glpManager.address,
        glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
        gmx: core.gmxEcosystem.gmx.address,
        gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
        gmxVault: core.gmxEcosystem.gmxVault.address,
        sGlp: core.gmxEcosystem.sGlp.address,
        sGmx: core.gmxEcosystem.sGmx.address,
        sbfGmx: core.gmxEcosystem.sbfGmx.address,
        vGlp: core.gmxEcosystem.vGlp.address,
        vGmx: core.gmxEcosystem.vGmx.address,
      },
      core.dolomiteMargin.address,
    ],
  );
}

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber);
  } else {
    console.log('Skipping forking...');
  }

  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const governance: SignerWithAddress = await impersonate(await DOLOMITE_MARGIN.connect(hhUser1).owner(), true);

  const dolomiteMargin = DOLOMITE_MARGIN.connect(governance);

  const expiry = EXPIRY.connect(governance);

  const borrowPositionProxyV2 = BORROW_POSITION_PROXY_V2.connect(governance);

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

  const depositWithdrawalProxy = DEPOSIT_WITHDRAWAL_PROXY.connect(hhUser1);

  const dolomiteAmmRouterProxy = DOLOMITE_AMM_ROUTER.connect(hhUser1);

  const esGmxAdmin = await impersonate(await ES_GMX_DISTRIBUTOR.connect(hhUser1).admin());

  return {
    borrowPositionProxyV2,
    depositWithdrawalProxy,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    expiry,
    testInterestSetter,
    testPriceOracle,
    governance,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    config: {
      blockNumber: config.blockNumber,
    },
    gmxEcosystem: {
      esGmx: ES_GMX.connect(hhUser1),
      esGmxDistributor: ES_GMX_DISTRIBUTOR.connect(esGmxAdmin),
      fsGlp: FS_GLP.connect(hhUser1),
      glp: GLP.connect(hhUser1),
      glpManager: GLP_MANAGER.connect(hhUser1),
      glpRewardsRouter: GLP_REWARDS_ROUTER.connect(hhUser1),
      gmxRewardsRouter: GMX_REWARDS_ROUTER.connect(hhUser1),
      gmx: GMX.connect(hhUser1),
      gmxVault: GMX_VAULT.connect(hhUser1),
      sGlp: S_GLP.connect(hhUser1),
      sGmx: S_GMX.connect(hhUser1),
      sbfGmx: SBF_GMX.connect(hhUser1),
      vGlp: V_GLP.connect(hhUser1),
      vGmx: V_GMX.connect(hhUser1),
    },
    liquidatorProxyV2: LIQUIDATOR_PROXY_V2.connect(hhUser1),
    liquidatorProxyV3: LIQUIDATOR_PROXY_V3.connect(hhUser1),
    marketIds: {
      usdc: USDC_MARKET_ID,
      weth: WETH_MARKET_ID,
    },
    usdc: USDC.connect(hhUser1),
    weth: WETH.connect(hhUser1),
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
