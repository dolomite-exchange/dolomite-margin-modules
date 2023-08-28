import {
  GLPIsolationModeTokenVaultV1__factory,
  GLPPriceOracleV1,
  GmxRegistryV1__factory,
  IGLPIsolationModeVaultFactory__factory,
  IGmxRegistryV1__factory,
} from '../../src/types';
import {
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderV1ConstructorParams,
  getGLPWrapperTraderV1ConstructorParams,
  getGmxRegistryConstructorParams,
} from '../../src/utils/constructors/gmx';
import { getAndCheckSpecificNetwork } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave } from '../deploy-utils';

async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const gmxRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'GmxRegistryV1',
    [],
    'GmxRegistryV1Implementation',
  );
  const gmxRegistryImplementation = GmxRegistryV1__factory.connect(gmxRegistryImplementationAddress, core.hhUser1);
  const gmxRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getGmxRegistryConstructorParams(gmxRegistryImplementation, core),
    'GmxRegistryProxy',
  );
  const gmxRegistry = IGmxRegistryV1__factory.connect(gmxRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeTokenVaultV1',
    [],
  );
  const userVaultImplementation = GLPIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const factoryAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeVaultFactory',
    getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
  const factory = IGLPIsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  await deployContractAndSave(
    Number(network),
    'GLPPriceOracleV1',
    getGLPPriceOracleV1ConstructorParams(factory, gmxRegistry),
  );
  await deployContractAndSave(
    Number(network),
    'GLPIsolationModeWrapperTraderV1',
    getGLPWrapperTraderV1ConstructorParams(core, factory, gmxRegistry),
  );
  await deployContractAndSave(
    Number(network),
    'GLPIsolationModeUnwrapperTraderV1',
    getGLPUnwrapperTraderV1ConstructorParams(core, factory, gmxRegistry),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
