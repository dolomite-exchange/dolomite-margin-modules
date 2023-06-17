import { ethers } from 'hardhat';
import { Network } from 'src/utils/no-deps-constants';
import {
  getMagicGLPUnwrapperTraderV2ConstructorParams,
  getMagicGLPWrapperTraderV2ConstructorParams,
} from '../src/utils/constructors/abracadabra';
import {
  getGLPUnwrapperTraderV2ConstructorParams,
  getGLPWrapperTraderV2ConstructorParams,
} from '../src/utils/constructors/gmx';
import {
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
} from '../src/utils/constructors/plutus';
import { setupCoreProtocol } from '../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from './deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  await deployContractAndSave(
    Number(network),
    'MagicGLPUnwrapperTraderV2',
    getMagicGLPUnwrapperTraderV2ConstructorParams(core),
  );
  await deployContractAndSave(
    Number(network),
    'MagicGLPWrapperTraderV2',
    getMagicGLPWrapperTraderV2ConstructorParams(core),
  );

  const glpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeUnwrapperTraderV2',
    getGLPUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.glpIsolationModeFactory,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
  );
  const glpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeWrapperTraderV2',
    getGLPWrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.glpIsolationModeFactory,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
  );

  const plvGlpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV2',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );
  const plvGlpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeWrapperTraderV2',
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );

  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(
      glpUnwrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpUnwrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.glpIsolationModeFactory.populateTransaction.setIsTokenConverterTrusted(
      glpWrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpWrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpUnwrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpWrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2, true)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
