import { Network } from '../../../src/utils/no-deps-constants';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import { CoreProtocolAbstract, CoreProtocolParams } from './core-protocol-abstract';

export interface CoreProtocolParamsEthereum {
  odosEcosystem: OdosEcosystem;
}

export class CoreProtocolEthereum extends CoreProtocolAbstract<Network.Ethereum> {
  public readonly odosEcosystem: OdosEcosystem;
  public readonly network: Network.Ethereum = Network.Ethereum;

  constructor(params: CoreProtocolParams<Network.Ethereum>, ethereumParams: CoreProtocolParamsEthereum) {
    super(params);
    this.odosEcosystem = ethereumParams.odosEcosystem;
  }
}
