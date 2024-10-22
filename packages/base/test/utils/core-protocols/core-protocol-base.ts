import { Network } from '../../../src/utils/no-deps-constants';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import { ParaswapEcosystem } from '../ecosystem-utils/paraswap';
import { CoreProtocolAbstract, CoreProtocolParams } from './core-protocol-abstract';

export interface CoreProtocolParamsBase {
  odosEcosystem: OdosEcosystem;
  paraswapEcosystem: ParaswapEcosystem;
}

export class CoreProtocolBase extends CoreProtocolAbstract<Network.Base> {

  public readonly paraswapEcosystem: ParaswapEcosystem;
  public readonly odosEcosystem: OdosEcosystem;
  public readonly network: Network.Base = Network.Base;

  constructor(
    params: CoreProtocolParams<Network.Base>,
    baseParams: CoreProtocolParamsBase,
  ) {
    super(params);
    this.odosEcosystem = baseParams.odosEcosystem;
    this.paraswapEcosystem = baseParams.paraswapEcosystem;
  }
}
