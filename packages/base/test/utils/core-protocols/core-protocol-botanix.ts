import { Network } from '../../../src/utils/no-deps-constants';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import { CoreProtocolAbstract, CoreProtocolParams } from './core-protocol-abstract';

export interface CoreProtocolParamsBotanix {
}

export class CoreProtocolBotanix extends CoreProtocolAbstract<Network.Botanix> {
  public readonly network: Network.Botanix = Network.Botanix;

  constructor(params: CoreProtocolParams<Network.Botanix>, botanixParams: CoreProtocolParamsBotanix) {
    super(params);
  }
}
