import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as deployments from '@dolomite-exchange/modules-scripts/src/deploy/deployments.json';
import {
  VesterImplementationV1,
  VesterImplementationV1__factory,
  VesterProxy,
  VesterProxy__factory
} from '@dolomite-exchange/modules-liquidity-mining/src/types';

export interface LiquidityMiningEcosystem {
  oArbVester: VesterImplementationV1;
  oArbVesterProxy: VesterProxy;
}

export async function createLiquidityMiningEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<LiquidityMiningEcosystem> {
  if (network !== '42161') {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    oArbVester: VesterImplementationV1__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterProxy: VesterProxy__factory.connect(deployments.VesterProxy[network].address, signer),
  };
}
