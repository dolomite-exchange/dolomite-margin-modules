import { getRegistryProxyConstructorParams } from '../../../../packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import { EventEmitterRegistry, EventEmitterRegistry__factory } from '../../../../src/types';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new EventEmitterRegistry contract + proxy
 * - Deploys the new DolomiteRegistry implementation contract
 * - Sets the dolomite registry implementation upgrade on the proxy
 * - Sets the event emitter registry on the dolomite registry
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const eventEmitterRegistryProxy = await createEventEmitterProxy(core, network);

  const newDolomiteRegistryImplementation = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV4',
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [newDolomiteRegistryImplementation],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetEventEmitter',
      [eventEmitterRegistryProxy.address],
    ),
  );

  return {
    transactions,
    chainId: network,
  };
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
  .then(jsonUpload => {
    if (typeof jsonUpload === 'undefined') {
      return;
    }

    const path = require('path');
    const scriptName = path.basename(__filename).slice(0, -3);
    const dir = `${__dirname}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(jsonUpload, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
