import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import {
  GLPPriceOracleV1,
  GLPIsolationModeTokenVaultV1__factory,
  IGLPIsolationModeVaultFactory__factory,
  IGmxRegistryV1__factory,
} from '../src/types';
import {
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderV1ConstructorParams,
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPWrapperTraderV1ConstructorParams,
  getGmxRegistryConstructorParams,
} from '../src/utils/constructors/gmx';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave } from './deploy-utils';

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const core = await setupCoreProtocol({ blockNumber: 0, network: chainId.toString() as Network });

  const gmxRegistryAddress = await deployContractAndSave(
    chainId,
    'GmxRegistryV1',
    getGmxRegistryConstructorParams(core),
  );
  const gmxRegistry = IGmxRegistryV1__factory.connect(gmxRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(chainId, 'GLPIsolationModeTokenVaultV1', []);
  const userVaultImplementation = GLPIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const factoryAddress = await deployContractAndSave(
    chainId,
    'GLPIsolationModeVaultFactory',
    getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
  const factory = IGLPIsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  await deployContractAndSave(
    chainId,
    'GLPPriceOracleV1',
    getGLPPriceOracleV1ConstructorParams(factory, gmxRegistry),
  );
  await deployContractAndSave(
    chainId,
    'GLPIsolationModeWrapperTraderV1',
    getGLPWrapperTraderV1ConstructorParams(core, factory, gmxRegistry),
  );
  await deployContractAndSave(
    chainId,
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
