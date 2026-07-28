import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  IParaswapAugustusRouterV5,
  IParaswapAugustusRouterV5__factory,
  IParaswapAugustusRouterV6,
  IParaswapAugustusRouterV6__factory,
  IParaswapFeeClaimer,
  IParaswapFeeClaimer__factory,
  ParaswapAggregatorTraderV2,
  ParaswapAggregatorTraderV2__factory,
} from '../../../src/types';
import {
  PARASWAP_AUGUSTUS_V5_ROUTER_MAP,
  PARASWAP_AUGUSTUS_V6_ROUTER_MAP,
  PARASWAP_FEE_CLAIMER_MAP,
  PARASWAP_TRANSFER_PROXY_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContractOpt } from '../setup';

export interface ParaswapEcosystem {
  augustusRouterV5: IParaswapAugustusRouterV5;
  augustusRouterV6: IParaswapAugustusRouterV6;
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
    augustusRouterV5: IParaswapAugustusRouterV5__factory.connect(PARASWAP_AUGUSTUS_V5_ROUTER_MAP[network]!, signer),
    augustusRouterV6: IParaswapAugustusRouterV6__factory.connect(PARASWAP_AUGUSTUS_V6_ROUTER_MAP[network]!, signer),
    feeClaimer: IParaswapFeeClaimer__factory.connect(PARASWAP_FEE_CLAIMER_MAP[network]!, signer),
    transferProxy: PARASWAP_TRANSFER_PROXY_MAP[network]!,
    live: {
      paraswapTrader: paraswapTrader as any,
    },
  };
}
