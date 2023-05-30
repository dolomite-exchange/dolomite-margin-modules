import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import {
  GLPPriceOracleV1,
  GLPWrappedTokenUserVaultV1__factory,
  IGLPWrappedTokenUserVaultFactory__factory,
  IGmxRegistryV1__factory,
} from '../src/types';
import {
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderConstructorParams,
  getGLPWrappedTokenUserVaultFactoryConstructorParams,
  getGLPWrapperTraderConstructorParams,
  getGmxRegistryConstructorParams,
} from '../src/utils/constructors/gmx';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const core = await setupCoreProtocol({ blockNumber: 0, network: chainId.toString() as Network });

  const gmxRegistryAddress = await deployContractAndSave(
    chainId,
    'GmxRegistryV1',
    getGmxRegistryConstructorParams(core),
  );
  const gmxRegistry = IGmxRegistryV1__factory.connect(gmxRegistryAddress, core.hhUser1);

  const userVaultImplementationAddress = await deployContractAndSave(chainId, 'GLPWrappedTokenUserVaultV1', []);
  const userVaultImplementation = GLPWrappedTokenUserVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const factoryAddress = await deployContractAndSave(
    chainId,
    'GLPWrappedTokenUserVaultFactory',
    getGLPWrappedTokenUserVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
  const factory = IGLPWrappedTokenUserVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  await deployContractAndSave(
    chainId,
    'GLPPriceOracleV1',
    getGLPPriceOracleV1ConstructorParams(factory, gmxRegistry),
  );
  await deployContractAndSave(
    chainId,
    'GLPWrapperTraderV1',
    getGLPWrapperTraderConstructorParams(core, factory, gmxRegistry),
  );
  await deployContractAndSave(
    chainId,
    'GLPUnwrapperTraderV1',
    getGLPUnwrapperTraderConstructorParams(core, factory, gmxRegistry),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
