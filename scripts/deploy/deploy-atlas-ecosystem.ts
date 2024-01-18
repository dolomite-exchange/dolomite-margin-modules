import { ethers } from 'hardhat';
import { ATLAS_SI_TOKEN_MAP } from '../../packages/base/src/utils/constants';
import { getAnyNetwork } from '../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../packages/base/test/utils/setup';
import { deployContractAndSave } from '../deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const userVaultImplementation = await deployContractAndSave(
    Number(network),
    'SimpleIsolationModeTokenVaultV1',
    [],
    'AtlasSIUserVaultV1',
  );
  await deployContractAndSave(Number(network), 'SimpleIsolationModeTokenFactory', [
    [core.marketIds.usdc],
    [],
    ATLAS_SI_TOKEN_MAP[network]!,
    core.borrowPositionProxyV2.address,
    userVaultImplementation,
    core.dolomiteMargin.address,
  ], 'AtlasSIUserVaultFactory');
  await deployContractAndSave(Number(network), 'TestAdminPriceOracleV1', [core.dolomiteMargin.address]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
