import { EventEmitterRegistry, EventEmitterRegistry__factory } from '../../../../src/types';
import { getRegistryProxyConstructorParams } from '../../../../src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new EventEmitterRegistry contract + proxy
 * - Deploys the new DolomiteRegistry implementation contract
 * - Sets the dolomite registry implementation upgrade on the proxy
 * - Sets the event emitter registry on the dolomite registry
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const eventEmitterRegistryProxy = await createEventEmitterProxy(core, network);

  const newDolomiteRegistryImplementation = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV4',
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteRegistryProxy',
    'upgradeTo',
    [newDolomiteRegistryImplementation],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteRegistry',
    'ownerSetEventEmitter',
    [eventEmitterRegistryProxy.address],
  );
}

async function createEventEmitterProxy(core: CoreProtocol, network: Network): Promise<EventEmitterRegistry> {
  const eventEmitterImplementationAddress = await deployContractAndSave(
    Number(network),
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV1',
  );
  const eventEmitterImplementation = EventEmitterRegistry__factory.connect(
    eventEmitterImplementationAddress,
    core.hhUser1,
  );
  const implementationCalldata = await eventEmitterImplementation.populateTransaction.initialize();
  const eventEmitterRegistryProxyAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    getRegistryProxyConstructorParams(eventEmitterImplementationAddress, implementationCalldata.data!, core),
    'EventEmitterRegistryProxy',
  );

  return EventEmitterRegistry__factory.connect(eventEmitterRegistryProxyAddress, core.hhUser1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
