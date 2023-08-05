import { ethers } from 'hardhat';
import { Network } from '../../../src/utils/no-deps-constants';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(network));

  const glpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeTokenVaultV1',
    [],
  );
  const jonesUsdcTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
  );
  const pendlePtGlpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'PendlePtGLP2024IsolationModeTokenVaultV1',
    [],
  );
  const plutusVaultGlpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core.gmxEcosystem!.live,
    'glpIsolationModeFactory',
    'setUserVaultImplementation',
    [glpTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactory',
    'ownerSetUserVaultImplementation',
    [jonesUsdcTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core.pendleEcosystem!.live,
    'ptGlpIsolationModeFactory',
    'ownerSetUserVaultImplementation',
    [pendlePtGlpTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core.plutusEcosystem!.live,
    'plvGlpIsolationModeFactory',
    'ownerSetUserVaultImplementation',
    [plutusVaultGlpTokenVaultAddress],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
