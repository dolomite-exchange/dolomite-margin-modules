import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface } from 'ethers';
import { ethers, network } from 'hardhat';
import {
  BorrowPositionProxyV2,
  IDolomiteAmmRouterProxy,
  IDolomiteMargin,
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
  WrappedTokenUserVaultProxy,
  WrappedTokenUserVaultProxy__factory,
} from '../../src/types';
import { BORROW_POSITION_PROXY_V2, DOLOMITE_AMM_ROUTER, DOLOMITE_MARGIN, USDC, WETH } from '../../src/utils/constants';
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
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
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
  const whaleSigner = await impersonate('0xCe2CC46682E9C6D5f174aF598fb4931a9c0bE68e');
  await USDC.connect(whaleSigner).transfer(signer.address, amount);
  await USDC.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export function setupUserVaultProxy<T extends BaseContract>(
  vault: address,
  factory: { abi: ContractInterface },
  signer?: SignerWithAddress,
): T {
  return new BaseContract(
    vault,
    factory.abi,
    signer,
  ) as T;
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

  const dolomiteAmmRouterProxy = DOLOMITE_AMM_ROUTER.connect(hhUser1);

  await setupWETHBalance(hhUser1, '1000000000000000000000', dolomiteMargin); // 1000 WETH

  return {
    borrowPositionProxyV2,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
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
  };
}

export async function setupTestMarket(
  core: CoreProtocol,
  token: { address: address },
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    core.testPriceOracle.address,
    core.testInterestSetter.address,
    { value: 0 },
    { value: 0 },
    0,
    true,
    false,
  );
}
