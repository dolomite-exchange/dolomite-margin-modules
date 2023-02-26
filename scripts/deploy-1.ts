import { ethers } from 'hardhat';
import { GLPPriceOracleV1 } from '../src/types';
import { setupCoreProtocol } from '../test/utils/setup';
import {
  getGlpUnwrapperTraderConstructorParams,
  getGlpWrapperTraderConstructorParams,
  getGmxRegistryConstructorParams,
} from '../test/utils/wrapped-token-utils';
import { deployContractAndSave } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const core = await setupCoreProtocol({ blockNumber: 0 });
  const gmxRegistryAddress = await deployContractAndSave(
    chainId,
    'GmxRegistryV1',
    getGmxRegistryConstructorParams(core),
  );
  const userVaultImplementationAddress = await deployContractAndSave(chainId, 'GLPWrappedTokenUserVaultV1', []);
  const factoryAddress = await deployContractAndSave(chainId, 'GLPWrappedTokenUserVaultFactory', [
    core.weth.address,
    core.marketIds.weth,
    gmxRegistryAddress,
    core.gmxEcosystem.fsGlp.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementationAddress,
    core.dolomiteMargin.address,
  ]);
  await deployContractAndSave(
    chainId,
    'GLPPriceOracleV1',
    [gmxRegistryAddress, factoryAddress],
  );
  await deployContractAndSave(
    chainId,
    'GLPWrapperTraderV1',
    getGlpWrapperTraderConstructorParams(core, { address: factoryAddress }, { address: gmxRegistryAddress }),
  );
  await deployContractAndSave(
    chainId,
    'GLPUnwrapperTraderV1',
    getGlpUnwrapperTraderConstructorParams(core, { address: factoryAddress }, { address: gmxRegistryAddress }),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
