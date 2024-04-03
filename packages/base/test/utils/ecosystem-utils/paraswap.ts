import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  IParaswapAugustusRouter,
  IParaswapAugustusRouter__factory,
  IParaswapFeeClaimer,
  IParaswapFeeClaimer__factory,
  ParaswapAggregatorTraderV2,
  ParaswapAggregatorTraderV2__factory,
} from '../../../src/types';
import {
  PARASWAP_AUGUSTUS_ROUTER_MAP,
  PARASWAP_FEE_CLAIMER_MAP,
  PARASWAP_TRANSFER_PROXY_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContractOpt } from '../setup';

export interface ParaswapEcosystem {
  augustusRouter: IParaswapAugustusRouter;
  feeClaimer: IParaswapFeeClaimer;
  transferProxy: string;
  live: {
    paraswapTrader: ParaswapAggregatorTraderV2;
  };
}

export async function createParaswapEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<ParaswapEcosystem> {
  const paraswapTrader = getContractOpt(
    (Deployments.ParaswapAggregatorTraderV2 as any)[network]?.address,
    ParaswapAggregatorTraderV2__factory.connect,
    signer,
  );

  return {
    augustusRouter: IParaswapAugustusRouter__factory.connect(PARASWAP_AUGUSTUS_ROUTER_MAP[network]!, signer),
    feeClaimer: IParaswapFeeClaimer__factory.connect(PARASWAP_FEE_CLAIMER_MAP[network]!, signer),
    transferProxy: PARASWAP_TRANSFER_PROXY_MAP[network]!,
    live: {
      paraswapTrader: paraswapTrader as any,
    },
  };
}
