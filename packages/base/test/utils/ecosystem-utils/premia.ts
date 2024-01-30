import { IAlgebraV3Pool, IAlgebraV3Pool__factory } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { PREMIA_WETH_V3_POOL_MAP } from '../../../src/utils/constants';
import { getContract } from '../setup';

export interface PremiaEcosystem {
  premiaWethV3Pool: IAlgebraV3Pool;
}

export async function createPremiaEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PremiaEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    premiaWethV3Pool: getContract(PREMIA_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
  };
}
