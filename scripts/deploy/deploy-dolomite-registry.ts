import { ethers } from 'hardhat';
import { DolomiteRegistryImplementation__factory } from '../../src/types';
import { getRegistryProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave } from '../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const implementationAddress = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
  );
  const implementation = DolomiteRegistryImplementation__factory.connect(implementationAddress, core.hhUser1);

  const calldata = await implementation.populateTransaction.initialize(core.genericTraderProxy!.address);
  await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    getRegistryProxyConstructorParams(implementationAddress, calldata.data!, core),
    'DolomiteRegistryProxy',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
