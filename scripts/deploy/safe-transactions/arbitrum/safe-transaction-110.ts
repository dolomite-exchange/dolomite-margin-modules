import { BigNumber } from 'ethers';
import { OARB, OARB__factory, VesterImplementation, VesterImplementation__factory } from '../../../../src/types';
import { getRegistryProxyConstructorParams } from '../../../../src/utils/constructors/dolomite';
import {
  getOARBConstructorParams, getVesterExploderConstructorParams, getVesterImplementationConstructorParams,
  getVesterProxyConstructorParams,
} from '../../../../src/utils/constructors/liquidity-mining';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Creates the VesterImplementationV1 contract
 * - Creates the VesterProxy contract
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const oARBAddress = await deployContractAndSave(
    Number(network),
    'OARB',
    getOARBConstructorParams(core),
  );
  const oARB = OARB__factory.connect(oARBAddress, core.hhUser1);
  const vesterProxy = await createVesterProxy(core, network, oARB);
  const vesterExploderAddress = await deployContractAndSave(
    Number(network),
    'VesterExploder',
    getVesterExploderConstructorParams(core, vesterProxy),
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetGlobalOperator',
    [vesterProxy.address, true],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetGlobalOperator',
    [vesterExploderAddress, true],
  );
}

async function createVesterProxy(core: CoreProtocol, network: Network, oARB: OARB): Promise<VesterImplementation> {
  const vesterImplementationAddress = await deployContractAndSave(
    Number(network),
    'VesterImplementation',
    getVesterImplementationConstructorParams(core),
    'VesterImplementationV1',
  );
  const vesterImplementation = VesterImplementation__factory.connect(
    vesterImplementationAddress,
    core.hhUser1,
  );
  const eventEmitterRegistryProxyAddress = await deployContractAndSave(
    Number(network),
    'VesterProxy',
    await getVesterProxyConstructorParams(core, vesterImplementation, oARB),
  );

  return VesterImplementation__factory.connect(eventEmitterRegistryProxyAddress, core.hhUser1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
