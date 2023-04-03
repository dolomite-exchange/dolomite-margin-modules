import { ethers } from 'hardhat';
import { Network, NONE_MARKET_ID } from 'src/utils/no-deps-constants';
import { ATLAS_SI_TOKEN_MAP } from '../src/utils/constants';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const userVaultImplementation = await deployContractAndSave(
    Number(network),
    'SimpleWrappedTokenUserVaultV1',
    [],
    'AtlasSIUserVaultV1',
  );
  await deployContractAndSave(Number(network), 'SimpleWrappedTokenUserVaultFactory', [
    [core.marketIds.usdc],
    [NONE_MARKET_ID],
    ATLAS_SI_TOKEN_MAP[network],
    core.borrowPositionProxyV2.address,
    userVaultImplementation,
    core.dolomiteMargin.address,
  ], 'AtlasSIUserVaultFactory');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
