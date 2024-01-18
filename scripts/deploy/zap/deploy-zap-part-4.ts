import { ethers } from 'hardhat';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../packages/base/test/utils/setup';
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
    core,
    core.gmxEcosystem!.live,
    'dGlp',
    'setUserVaultImplementation',
    [glpTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactory',
    'ownerSetUserVaultImplementation',
    [jonesUsdcTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.pendleEcosystem!.glpMar2024,
    'dPtGlp2024',
    'ownerSetUserVaultImplementation',
    [pendlePtGlpTokenVaultAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
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
