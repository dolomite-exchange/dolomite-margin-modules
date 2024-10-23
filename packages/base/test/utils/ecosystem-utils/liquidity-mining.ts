import * as deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  ExternalOARB,
  ExternalOARB__factory,
  ExternalVesterImplementationV1,
  ExternalVesterImplementationV1__factory,
  MineralToken,
  MineralToken__factory,
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  VesterImplementationV1,
  VesterImplementationV1__factory,
  VesterImplementationV2,
  VesterImplementationV2__factory,
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

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
  library: Record<string, string>;
}

export interface GoARBLiquidityMiningEcosystem {
  goArbVester: ExternalVesterImplementationV1;
  goArbVesterProxy: UpgradeableProxy;
  goArb: ExternalOARB;
}

export interface LiquidityMiningEcosystemArbitrumOne {
  goARB: GoARBLiquidityMiningEcosystem;
  minerals: MineralLiquidityMiningEcosystem;
  oARB: OARBLiquidityMiningEcosystem;
}

export interface LiquidityMiningEcosystemXLayer {
  minerals: MineralLiquidityMiningEcosystem;
}

export async function createGoARBLiquidityMiningEcosystem(
  network: Network.ArbitrumOne,
  signer: SignerWithAddressWithSafety,
): Promise<GoARBLiquidityMiningEcosystem> {
  return {
    goArbVester: ExternalVesterImplementationV1__factory.connect(
      deployments.GravitaExternalVesterProxy[network].address,
      signer,
    ),
    goArbVesterProxy: UpgradeableProxy__factory.connect(
      deployments.GravitaExternalVesterProxy[network].address,
      signer,
    ),
    goArb: ExternalOARB__factory.connect(deployments.GravitaOArbToken[network].address, signer),
  };
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
    library: {
      VesterImplementationLibForV2: getMaxDeploymentVersionAddressByDeploymentKey(
        'VesterImplementationLibFor',
        network,
      ),
    },
  };
}
