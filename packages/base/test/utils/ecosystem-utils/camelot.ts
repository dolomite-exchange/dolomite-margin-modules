import { IAlgebraV3Pool, IAlgebraV3Pool__factory } from '@dolomite-exchange/modules-oracles/src/types';
import {
  DPX_WETH_V3_POOL_MAP,
  GRAIL_USDC_V3_POOL_MAP,
  GRAIL_WETH_V3_POOL_MAP,
  SIZE_WETH_V3_POOL_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContract } from '../setup';

export interface CamelotEcosystem {
  dpxWethV3Pool: IAlgebraV3Pool;
  grailUsdcV3Pool: IAlgebraV3Pool;
  grailWethV3Pool: IAlgebraV3Pool;
  sizeWethV3Pool: IAlgebraV3Pool;
}

export async function createCamelotEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<CamelotEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    dpxWethV3Pool: getContract(DPX_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    grailUsdcV3Pool: getContract(GRAIL_USDC_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    grailWethV3Pool: getContract(GRAIL_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    sizeWethV3Pool: getContract(SIZE_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
  };
}
