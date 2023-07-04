import { CoreProtocol } from '../../../test/utils/setup';

export function getRegistryProxyConstructorParams(
  implementationAddress: string,
  implementationCalldata: string,
  core: CoreProtocol,
): any[] {
  return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}
