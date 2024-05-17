import * as deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  VesterImplementationV1,
  VesterImplementationV1__factory,
  VesterImplementationV2,
  VesterImplementationV2__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  OARB__factory,
  OARB,
  MineralToken__factory,
  RewardsDistributor__factory,
  RewardsDistributor, MineralToken,
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface MineralLiquidityMiningEcosystem {
  mineralDistributor: RewardsDistributor;
  mineralToken: MineralToken;
  mineralTokenProxy: UpgradeableProxy;
}

export interface OARBLiquidityMiningEcosystem {
  oArbVester: VesterImplementationV1;
  oArbVesterV2: VesterImplementationV2;
  oArbVesterProxy: UpgradeableProxy;
  oArb: OARB;
}

export async function createMineralLiquidityMiningEcosystem(
  network: Network.ArbitrumOne | Network.XLayer,
  signer: SignerWithAddressWithSafety,
): Promise<MineralLiquidityMiningEcosystem> {
  return {
    mineralDistributor: RewardsDistributor__factory.connect(deployments.MineralDistributor[network].address, signer),
    mineralToken: MineralToken__factory.connect(deployments.MineralTokenProxy[network].address, signer),
    mineralTokenProxy: UpgradeableProxy__factory.connect(deployments.MineralTokenProxy[network].address, signer),
  };
}

export async function createOARBLiquidityMiningEcosystem(
  network: Network.ArbitrumOne,
  signer: SignerWithAddressWithSafety,
): Promise<OARBLiquidityMiningEcosystem> {
  return {
    oArbVester: VesterImplementationV1__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterV2: VesterImplementationV2__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterProxy: UpgradeableProxy__factory.connect(deployments.VesterProxy[network].address, signer),
    oArb: OARB__factory.connect(deployments.OARB[network].address, signer),
  };
}
