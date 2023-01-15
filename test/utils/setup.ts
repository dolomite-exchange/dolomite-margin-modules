import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers, network } from 'hardhat';
import { IDolomiteAmmRouterProxy, IDolomiteMargin } from '../../src/types';
import { DOLOMITE_AMM_ROUTER, DOLOMITE_MARGIN, USDC, WETH } from '../../src/utils/constants';
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
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
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

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber);
  } else {
    console.log('Skipping forking...');
  }

  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const admin: SignerWithAddress = await impersonate(await DOLOMITE_MARGIN.connect(hhUser1).owner(), true);

  const dolomiteMargin = DOLOMITE_MARGIN.connect(admin);

  const dolomiteAmmRouterProxy = DOLOMITE_AMM_ROUTER.connect(hhUser1);

  await setupWETHBalance(hhUser1, '1000000000000000000000', dolomiteMargin); // 1000 WETH

  return {
    config: {
      blockNumber: config.blockNumber,
    },
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    governance: admin,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
  };
}
