import * as deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  VesterImplementationV1,
  VesterImplementationV1__factory,
  VesterImplementationV2,
  VesterImplementationV2__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory, OARB__factory, OARB,
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface LiquidityMiningEcosystem {
  oArbVester: VesterImplementationV1;
  oArbVesterV2: VesterImplementationV2;
  oArbVesterProxy: UpgradeableProxy;
  oArb: OARB;
}

export async function createLiquidityMiningEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<LiquidityMiningEcosystem> {
  if (network !== '42161') {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    oArbVester: VesterImplementationV1__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterV2: VesterImplementationV2__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterProxy: UpgradeableProxy__factory.connect(deployments.VesterProxy[network].address, signer),
    oArb: OARB__factory.connect(deployments.OARB[network].address, signer),
  };
}
